import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseAuthProfile,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import {
  UserProfile,
  ElectricityMeter,
  MonthlyRecord,
  MeterReading,
  AppNotification,
  AuditLog,
  PageId,
  MeterIconType,
  VALIDATION_CONSTRAINTS,
} from '../types';
import {
  calculateUnitsConsumed,
  calculateUsagePercentage,
  calculateEstimatedBill,
  analyzeConsumptionThreshold,
  shouldDispatchThresholdAlert,
  validateReadingEntry,
  formatMonthLabel,
} from '../utils/calculations';
import { createDefaultUserProfile, createEmptyDataset } from '../utils/sampleData';
import {
  registerNotificationServiceWorker,
  sendDeviceNotification,
} from '../utils/notifications';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface LocalAccountRecord {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
}

interface WattWiseContextValue {
  // Auth & Profile
  isAuthReady: boolean;
  isLoadingData: boolean;
  isAuthenticated: boolean;
  isFirestoreBacked: boolean;
  firebaseConsoleNotice: string | null;
  dismissFirebaseConsoleNotice: () => void;
  userProfile: UserProfile | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPasswordForEmail: (email: string, newPassword?: string) => Promise<string>;
  logoutUser: () => Promise<void>;
  deleteCurrentAccount: () => Promise<void>;

  // Navigation & UI state
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  selectedMeterId: string | null;
  setSelectedMeterId: (meterId: string | null) => void;
  editingMeter: ElectricityMeter | null;
  setEditingMeter: (meter: ElectricityMeter | null) => void;
  showSetupWizard: boolean;
  setShowSetupWizard: (show: boolean) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  addToast: (title: string, message: string, type?: ToastMessage['type']) => void;

  // Data collections
  meters: ElectricityMeter[];
  months: MonthlyRecord[];
  readings: MeterReading[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];

  // Core Actions
  addMeter: (input: {
    meterName: string;
    meterNumber: string;
    consumerId?: string;
    referenceNumber?: string;
    ownerName?: string;
    location: string;
    provider: string;
    iconType: MeterIconType;
    monthlyLimit: number;
    estimatedRate: number;
    fixedCharges?: number;
    initialReading: number;
  }) => Promise<ElectricityMeter>;
  updateMeter: (
    meterId: string,
    updates: Partial<
      Pick<
        ElectricityMeter,
        | 'meterName'
        | 'meterNumber'
        | 'consumerId'
        | 'referenceNumber'
        | 'ownerName'
        | 'location'
        | 'provider'
        | 'iconType'
        | 'monthlyLimit'
        | 'estimatedRate'
        | 'fixedCharges'
        | 'additionalCharges'
        | 'taxPercentage'
        | 'isActive'
        | 'isArchived'
      >
    >
  ) => Promise<void>;
  deleteMeter: (meterId: string) => Promise<void>;
  recordReading: (input: {
    meterId: string;
    readingValue: number;
    readingDate: string;
    note?: string;
    isRolloverOrCorrection?: boolean;
  }) => Promise<void>;
  correctReadingEntry: (input: {
    readingId: string;
    newReadingValue: number;
    reason: string;
  }) => Promise<void>;
  startNewMonth: (input: {
    targetMonthId: string;
    meterIds: string[];
    closingOverrides?: Record<string, number>;
  }) => Promise<void>;
  correctHistoricalMonthRecord: (input: {
    meterId: string;
    monthId: string;
    newOpeningReading: number;
    newClosingReading: number;
    reason: string;
  }) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  markNotificationRead: (notificationId: string, isRead?: boolean) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  triggerDeviceTestNotification: () => Promise<void>;
  clearAllUserData: () => Promise<void>;
}

const WattWiseContext = createContext<WattWiseContextValue | undefined>(undefined);

const LOCAL_ACCOUNTS_KEY = 'wattwise_registered_accounts_v4';
const LOCAL_SESSION_KEY = 'wattwise_active_session_v4';
const getWorkspaceKey = (userId: string) => `wattwise_workspace_${userId}_v4`;

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, VALIDATION_CONSTRAINTS.MAX_ID_LEN);
  return cleaned || `id-${Date.now()}`;
}

function encodeEmailSlug(email: string): string {
  const clean = email.trim().toLowerCase();
  return Array.from(clean)
    .map((ch) => {
      if (/[a-z0-9]/.test(ch)) return ch;
      if (ch === '@') return '_at_';
      if (ch === '.') return '_dot_';
      return `_${ch.charCodeAt(0).toString(16)}_`;
    })
    .join('');
}

function getEmailAccountKey(email: string): string {
  return sanitizeId(`acct-${encodeEmailSlug(email)}`);
}

function getDeterministicUserId(email: string): string {
  return sanitizeId(`usr-${encodeEmailSlug(email)}`);
}

export const WattWiseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirestoreBacked, setIsFirestoreBacked] = useState(false);
  const [firebaseConsoleNotice, setFirebaseConsoleNotice] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [editingMeter, setEditingMeter] = useState<ElectricityMeter | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [meters, setMeters] = useState<ElectricityMeter[]>([]);
  const [months, setMonths] = useState<MonthlyRecord[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const unsubscribersRef = useRef<Array<() => void>>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (title: string, message: string, type: ToastMessage['type'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  useEffect(() => {
    registerNotificationServiceWorker();
  }, []);

  const clearFirestoreListeners = useCallback(() => {
    unsubscribersRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore cleanup error
      }
    });
    unsubscribersRef.current = [];
  }, []);

  const persistLocalWorkspace = useCallback(
    (
      userId: string,
      data: {
        profile: UserProfile;
        meters: ElectricityMeter[];
        months: MonthlyRecord[];
        readings: MeterReading[];
        notifications: AppNotification[];
        auditLogs: AuditLog[];
      }
    ) => {
      try {
        localStorage.setItem(getWorkspaceKey(userId), JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save workspace to localStorage', e);
      }
    },
    []
  );

  // Sync state to local storage when in local mode
  useEffect(() => {
    if (isAuthenticated && userProfile && !isFirestoreBacked) {
      persistLocalWorkspace(userProfile.userId, {
        profile: userProfile,
        meters,
        months,
        readings,
        notifications,
        auditLogs,
      });
    }
  }, [
    isAuthenticated,
    isFirestoreBacked,
    userProfile,
    meters,
    months,
    readings,
    notifications,
    auditLogs,
    persistLocalWorkspace,
  ]);

  const loadLocalWorkspace = useCallback((userId: string, name: string, email: string) => {
    setIsLoadingData(true);
    try {
      const raw = localStorage.getItem(getWorkspaceKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserProfile(parsed.profile);
        setMeters(parsed.meters || []);
        setMonths(parsed.months || []);
        setReadings(parsed.readings || []);
        setNotifications(parsed.notifications || []);
        setAuditLogs(parsed.auditLogs || []);
        if ((parsed.meters || []).length > 0) {
          setSelectedMeterId(parsed.meters[0].meterId);
        } else {
          setSelectedMeterId(null);
        }
      } else {
        const defaultProfile = createDefaultUserProfile(userId, name, email);
        const empty = createEmptyDataset();
        setUserProfile(defaultProfile);
        setMeters(empty.meters);
        setMonths(empty.months);
        setReadings(empty.readings);
        setNotifications(empty.notifications);
        setAuditLogs(empty.auditLogs);
        setSelectedMeterId(null);
        persistLocalWorkspace(userId, {
          profile: defaultProfile,
          ...empty,
        });
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [persistLocalWorkspace]);

  const purgeFirestoreUserCollections = useCallback(async (uid: string) => {
    try {
      const metersSnap = await getDocs(collection(db, `users/${uid}/meters`));
      for (const mDoc of metersSnap.docs) {
        const monthsSnap = await getDocs(collection(db, `users/${uid}/meters/${mDoc.id}/months`));
        for (const moDoc of monthsSnap.docs) {
          const readingsSnap = await getDocs(
            collection(db, `users/${uid}/meters/${mDoc.id}/months/${moDoc.id}/readings`)
          );
          for (const rDoc of readingsSnap.docs) {
            await deleteDoc(rDoc.ref);
          }
          await deleteDoc(moDoc.ref);
        }
        await deleteDoc(mDoc.ref);
      }

      const notifsSnap = await getDocs(collection(db, `users/${uid}/notifications`));
      for (const nDoc of notifsSnap.docs) {
        await deleteDoc(nDoc.ref);
      }
    } catch {
      // ignore cleanup errors
    }
  }, []);

  const migrateLocalWorkspaceToFirestore = useCallback(async (uid: string) => {
    try {
      const raw = localStorage.getItem(getWorkspaceKey(uid));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        profile?: UserProfile;
        meters?: ElectricityMeter[];
        months?: MonthlyRecord[];
        readings?: MeterReading[];
        notifications?: AppNotification[];
      };
      if (!parsed.meters || parsed.meters.length === 0) return;

      const existingMetersSnap = await getDocs(collection(db, `users/${uid}/meters`));
      if (!existingMetersSnap.empty) return;

      const batch = writeBatch(db);
      for (const m of parsed.meters) {
        const mRef = doc(db, 'users', uid, 'meters', m.meterId);
        const { createdAt, updatedAt, ...cleanMeter } = m;
        batch.set(mRef, {
          ...cleanMeter,
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const mo of parsed.months || []) {
        const moRef = doc(db, 'users', uid, 'meters', mo.meterId, 'months', mo.monthId);
        const { createdAt, updatedAt, ...cleanMonth } = mo;
        batch.set(moRef, {
          ...cleanMonth,
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const r of parsed.readings || []) {
        const rRef = doc(
          db,
          'users',
          uid,
          'meters',
          r.meterId,
          'months',
          r.monthId,
          'readings',
          r.readingId
        );
        const { createdAt, updatedAt, ...cleanReading } = r;
        batch.set(rRef, {
          ...cleanReading,
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch {
      // ignore migration errors
    }
  }, []);

  const setupFirestoreWorkspace = useCallback(
    async (uidInput: string, defaultName: string = 'User', defaultEmail: string = '') => {
      clearFirestoreListeners();
      setIsLoadingData(true);
      const uid = sanitizeId(uidInput);
      const userDocPath = `users/${uid}`;
      const userRef = doc(db, 'users', uid);

      try {
        const userSnap = await getDoc(userRef);
        let profileData: UserProfile;

        if (!userSnap.exists()) {
          profileData = createDefaultUserProfile(
            uid,
            defaultName || 'User',
            defaultEmail || ''
          );
          await setDoc(userRef, {
            ...profileData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          profileData = userSnap.data() as UserProfile;
        }

        setUserProfile(profileData);
        setIsFirestoreBacked(true);

        // Migrate any local meters/readings on this device to Firestore if Firestore is empty
        await migrateLocalWorkspaceToFirestore(uid);

        // Attach real-time listeners with handleFirestoreError
        const unsubUser = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data() as UserProfile);
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, userDocPath)
        );

        const metersPath = `users/${uid}/meters`;
        const unsubMeters = onSnapshot(
          collection(db, metersPath),
          async (snap) => {
            const loadedMeters: ElectricityMeter[] = [];
            snap.forEach((d) => loadedMeters.push(d.data() as ElectricityMeter));
            setMeters(loadedMeters);
            if (loadedMeters.length > 0) {
              setSelectedMeterId((prev) => prev || loadedMeters[0].meterId);
            } else {
              setSelectedMeterId(null);
            }

            // Load months & readings for each meter
            const allMonths: MonthlyRecord[] = [];
            const allReadings: MeterReading[] = [];

            for (const m of loadedMeters) {
              const monthsCollectionPath = `users/${uid}/meters/${m.meterId}/months`;
              try {
                const mSnap = await getDocs(collection(db, monthsCollectionPath));
                for (const md of mSnap.docs) {
                  const monthRecord = md.data() as MonthlyRecord;
                  allMonths.push(monthRecord);
                  const readingsCollectionPath = `${monthsCollectionPath}/${monthRecord.monthId}/readings`;
                  const rSnap = await getDocs(collection(db, readingsCollectionPath));
                  rSnap.forEach((rd) => allReadings.push(rd.data() as MeterReading));
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.LIST, monthsCollectionPath);
              }
            }
            setMonths(allMonths);
            setReadings(allReadings);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, metersPath)
        );

        const notifsPath = `users/${uid}/notifications`;
        const unsubNotifs = onSnapshot(
          collection(db, notifsPath),
          (snap) => {
            const list: AppNotification[] = [];
            snap.forEach((d) => {
              const data = d.data() as AppNotification & {
                createdAt?: { toDate?: () => Date };
              };
              const iso =
                data.createdAt && typeof data.createdAt.toDate === 'function'
                  ? data.createdAt.toDate().toISOString()
                  : data.timestampIso || new Date().toISOString();
              list.push({ ...data, timestampIso: iso });
            });
            list.sort((a, b) =>
              (b.timestampIso || '').localeCompare(a.timestampIso || '')
            );
            setNotifications(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, notifsPath)
        );

        const auditsPath = `users/${uid}/auditLogs`;
        const unsubAudits = onSnapshot(
          collection(db, auditsPath),
          (snap) => {
            const list: AuditLog[] = [];
            snap.forEach((d) => {
              const data = d.data() as AuditLog & {
                createdAt?: { toDate?: () => Date };
              };
              const iso =
                data.createdAt && typeof data.createdAt.toDate === 'function'
                  ? data.createdAt.toDate().toISOString()
                  : data.timestampIso || new Date().toISOString();
              list.push({ ...data, timestampIso: iso });
            });
            list.sort((a, b) =>
              (b.timestampIso || '').localeCompare(a.timestampIso || '')
            );
            setAuditLogs(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, auditsPath)
        );

        unsubscribersRef.current = [unsubUser, unsubMeters, unsubNotifs, unsubAudits];
        setIsLoadingData(false);
      } catch (error) {
        setIsLoadingData(false);
        loadLocalWorkspace(uid, defaultName, defaultEmail);
      }
    },
    [clearFirestoreListeners, migrateLocalWorkspaceToFirestore, loadLocalWorkspace]
  );

  // Sync any existing local accounts on this device to Firestore so they can sign in on any device
  useEffect(() => {
    const syncExistingLocalAccounts = async () => {
      try {
        const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
        if (!rawAccounts) return;
        const accounts: LocalAccountRecord[] = JSON.parse(rawAccounts);
        for (const acct of accounts) {
          if (!acct.email || !acct.passwordHash) continue;
          const emailKey = getEmailAccountKey(acct.email);
          const acctRef = doc(db, 'accounts', emailKey);
          const snap = await getDoc(acctRef);
          if (!snap.exists()) {
            const uid = sanitizeId(acct.userId || getDeterministicUserId(acct.email));
            await setDoc(acctRef, {
              accountId: emailKey,
              userId: uid,
              name: acct.name || 'User',
              email: acct.email.toLowerCase(),
              passwordHash: acct.passwordHash,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await migrateLocalWorkspaceToFirestore(uid);
          }
        }
      } catch {
        // ignore background sync errors
      }
    };
    syncExistingLocalAccounts();
  }, [migrateLocalWorkspaceToFirestore]);

  // Check active session on mount & listen to Firebase Auth state across devices
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setIsAuthenticated(true);
        setIsFirestoreBacked(true);
        await setupFirestoreWorkspace(
          fbUser.uid,
          fbUser.displayName || 'User',
          fbUser.email || ''
        );
        setIsAuthReady(true);
      } else {
        // Check saved session and connect to Firestore workspace
        const savedSessionRaw = localStorage.getItem(LOCAL_SESSION_KEY);
        if (savedSessionRaw) {
          try {
            const savedSession = JSON.parse(savedSessionRaw) as {
              userId: string;
              name: string;
              email: string;
            };
            if (savedSession.userId && savedSession.email) {
              setIsAuthenticated(true);
              setIsFirestoreBacked(true);
              await setupFirestoreWorkspace(
                savedSession.userId,
                savedSession.name || 'User',
                savedSession.email
              );
              setIsAuthReady(true);
              return;
            } else {
              localStorage.removeItem(LOCAL_SESSION_KEY);
            }
          } catch {
            localStorage.removeItem(LOCAL_SESSION_KEY);
          }
        }

        setIsAuthenticated(false);
        setIsFirestoreBacked(false);
        setUserProfile(null);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribe();
      clearFirestoreListeners();
    };
  }, [setupFirestoreWorkspace, clearFirestoreListeners]);

  // Helper to dispatch a new notification (in-app + device notification bar)
  const createNotificationInternal = useCallback(
    async (params: {
      meterId: string;
      meterName: string;
      monthId: string;
      type: AppNotification['type'];
      category: AppNotification['category'];
      title: string;
      message: string;
      threshold: number;
    }) => {
      if (!userProfile) return;
      const notificationId = sanitizeId(`notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const channels: string[] = [];
      if (userProfile.inAppNotifications) channels.push('in-app');
      if (userProfile.browserPushNotifications) channels.push('browser-push');
      if (userProfile.emailNotifications) channels.push('email');
      const deliveryChannel = (channels.join(', ') || 'in-app').slice(0, 60);

      const newNotif: AppNotification = {
        notificationId,
        userId: userProfile.userId,
        meterId: sanitizeId(params.meterId),
        meterName: params.meterName.slice(0, VALIDATION_CONSTRAINTS.MAX_METER_NAME_LEN) || 'Meter',
        monthId: params.monthId,
        type: params.type,
        category: params.category,
        title: params.title.slice(0, VALIDATION_CONSTRAINTS.MAX_TITLE_LEN),
        message: params.message.slice(0, VALIDATION_CONSTRAINTS.MAX_MESSAGE_LEN),
        threshold: Math.min(200, Math.max(0, Math.round(params.threshold))),
        isRead: false,
        deliveryChannel,
        timestampIso: new Date().toISOString(),
      };

      if (isFirestoreBacked) {
        const path = `users/${userProfile.userId}/notifications/${notificationId}`;
        try {
          const { timestampIso, ...firestorePayload } = newNotif;
          await setDoc(doc(db, 'users', userProfile.userId, 'notifications', notificationId), {
            ...firestorePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        setNotifications((prev) => [newNotif, ...prev]);
      }

      if (userProfile.inAppNotifications) {
        addToast(
          newNotif.title,
          newNotif.message,
          params.threshold >= 80 ? 'warning' : 'info'
        );
      }

      if (userProfile.browserPushNotifications) {
        await sendDeviceNotification(
          `⚡ WattWise: ${newNotif.title}`,
          newNotif.message,
          notificationId
        );
      }
    },
    [userProfile, isFirestoreBacked, addToast]
  );

  // Scheduled background reminder check (Smart Notification Frequency & Reading Due Reminders)
  useEffect(() => {
    if (!isAuthenticated || !userProfile || meters.length === 0) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      meters.forEach((meter) => {
        if (!meter.isActive || meter.isArchived) return;
        const pct = calculateUsagePercentage(meter.unitsConsumed, meter.monthlyLimit);
        const check = shouldDispatchThresholdAlert(
          pct,
          meter.lastAlertThreshold,
          meter.lastAlertSentAt,
          userProfile.quietHoursStart,
          userProfile.quietHoursEnd,
          now
        );

        if (check.shouldSend && check.isRecurringReminder && check.analysis.notificationType) {
          const nowIso = now.toISOString();
          createNotificationInternal({
            meterId: meter.meterId,
            meterName: meter.meterName,
            monthId: meter.currentMonthId,
            type: check.analysis.notificationType,
            category: 'reminder',
            title: `${meter.meterName} recurring usage alert (${pct}%)`,
            message: `${meter.meterName} (${meter.meterNumber}) is at ${meter.unitsConsumed.toLocaleString()} / ${meter.monthlyLimit.toLocaleString()} units (${pct}%).`,
            threshold: check.analysis.threshold,
          });

          if (isFirestoreBacked) {
            const mPath = `users/${userProfile.userId}/meters/${meter.meterId}`;
            updateDoc(doc(db, 'users', userProfile.userId, 'meters', meter.meterId), {
              lastAlertSentAt: nowIso,
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, mPath));
          } else {
            setMeters((prev) =>
              prev.map((m) =>
                m.meterId === meter.meterId ? { ...m, lastAlertSentAt: nowIso } : m
              )
            );
          }
        }
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, userProfile, meters, isFirestoreBacked, createNotificationInternal]);

  // Auth Handlers
  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setIsAuthenticated(true);
      setIsFirestoreBacked(true);
      await setupFirestoreWorkspace(
        cred.user.uid,
        cred.user.displayName || 'User',
        cred.user.email || ''
      );
      addToast('Signed in with Google', `Welcome back, ${cred.user.displayName || cred.user.email}!`, 'success');
    }
  }, [setupFirestoreWorkspace, addToast]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }
      if (!password) {
        throw new Error('Please enter your password.');
      }

      const emailKey = getEmailAccountKey(cleanEmail);
      const acctRef = doc(db, 'accounts', emailKey);

      // 1. Check Firebase Cloud Firestore /accounts/{emailKey} (works across all devices)
      try {
        const acctSnap = await getDoc(acctRef);
        if (acctSnap.exists()) {
          const acctData = acctSnap.data() as {
            accountId: string;
            userId: string;
            name: string;
            email: string;
            passwordHash: string;
          };

          if (acctData.passwordHash !== password) {
            throw new Error('Incorrect password. Please try again or reset your password.');
          }

          // Also sign in via Firebase Auth if enabled
          try {
            await signInWithEmailAndPassword(auth, cleanEmail, password);
          } catch {
            // Firebase Auth email/password provider may not be enabled; Firestore session handles cross-device sync
          }

          // Save local session cache
          const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
          const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
          const filtered = accounts.filter((a) => a.email.toLowerCase() !== cleanEmail);
          localStorage.setItem(
            LOCAL_ACCOUNTS_KEY,
            JSON.stringify([
              ...filtered,
              {
                userId: acctData.userId,
                name: acctData.name,
                email: acctData.email,
                passwordHash: password,
              },
            ])
          );
          localStorage.setItem(
            LOCAL_SESSION_KEY,
            JSON.stringify({
              userId: acctData.userId,
              name: acctData.name,
              email: acctData.email,
            })
          );

          setIsAuthenticated(true);
          setIsFirestoreBacked(true);
          await setupFirestoreWorkspace(acctData.userId, acctData.name, acctData.email);
          addToast('Welcome back!', `Signed in as ${acctData.name}`, 'success');
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Incorrect password')) {
          throw err;
        }
      }

      // 2. If not yet in /accounts/{emailKey}, try Firebase Auth or local storage and backfill to Firestore
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (cred.user) {
          const uid = sanitizeId(cred.user.uid);
          const displayName = cred.user.displayName || cleanEmail.split('@')[0] || 'User';
          try {
            await setDoc(acctRef, {
              accountId: emailKey,
              userId: uid,
              name: displayName,
              email: cleanEmail,
              passwordHash: password,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore
          }
          localStorage.setItem(
            LOCAL_SESSION_KEY,
            JSON.stringify({ userId: uid, name: displayName, email: cleanEmail })
          );
          setIsAuthenticated(true);
          setIsFirestoreBacked(true);
          await setupFirestoreWorkspace(uid, displayName, cleanEmail);
          addToast('Welcome back!', `Signed in as ${displayName}`, 'success');
          return;
        }
      } catch (fbErr: unknown) {
        const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
        const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
        const found = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

        if (!found) {
          const errMessage = fbErr instanceof Error ? fbErr.message : '';
          if (errMessage.includes('wrong-password')) {
            throw new Error('Incorrect password. Please try again.');
          }
          throw new Error('No account found with this email address. Please click "Create Account" to register first.');
        }

        if (found.passwordHash !== password) {
          throw new Error('Incorrect password. Please try again or reset your password.');
        }

        const uid = sanitizeId(found.userId || getDeterministicUserId(cleanEmail));
        try {
          await setDoc(acctRef, {
            accountId: emailKey,
            userId: uid,
            name: found.name,
            email: cleanEmail,
            passwordHash: password,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }

        localStorage.setItem(
          LOCAL_SESSION_KEY,
          JSON.stringify({
            userId: uid,
            name: found.name,
            email: found.email,
          })
        );

        setIsAuthenticated(true);
        setIsFirestoreBacked(true);
        await setupFirestoreWorkspace(uid, found.name, found.email);
        addToast('Welcome back!', `Signed in as ${found.name}`, 'success');
      }
    },
    [setupFirestoreWorkspace, addToast]
  );

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanName) {
        throw new Error('Please enter your full name.');
      }
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const emailKey = getEmailAccountKey(cleanEmail);
      const acctRef = doc(db, 'accounts', emailKey);

      // Check if account already exists in Firestore
      try {
        const existingSnap = await getDoc(acctRef);
        if (existingSnap.exists()) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('already exists')) {
          throw err;
        }
      }

      let userId = getDeterministicUserId(cleanEmail);

      // Also attempt Firebase Auth registration if enabled
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cred.user) {
          await updateFirebaseAuthProfile(cred.user, { displayName: cleanName });
          userId = sanitizeId(cred.user.uid);
        }
      } catch (fbErr: unknown) {
        const errMessage = fbErr instanceof Error ? fbErr.message : '';
        if (errMessage.includes('email-already-in-use')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
      }

      // Save account credentials to Firebase Cloud Firestore /accounts/{emailKey} for cross-device sign-in
      try {
        await setDoc(acctRef, {
          accountId: emailKey,
          userId,
          name: cleanName,
          email: cleanEmail,
          passwordHash: password,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Failed to save account record to Firestore:', err);
      }

      // Save local cache & session
      const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
      const filteredAccounts = accounts.filter((a) => a.email.toLowerCase() !== cleanEmail);
      const newAccount: LocalAccountRecord = {
        userId,
        name: cleanName,
        email: cleanEmail,
        passwordHash: password,
      };
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify([...filteredAccounts, newAccount]));
      localStorage.setItem(
        LOCAL_SESSION_KEY,
        JSON.stringify({ userId, name: cleanName, email: cleanEmail })
      );

      setIsAuthenticated(true);
      setIsFirestoreBacked(true);
      await setupFirestoreWorkspace(userId, cleanName, cleanEmail);
      setShowSetupWizard(true);
      addToast('Account Created!', `Welcome to WattWise, ${cleanName}!`, 'success');
    },
    [setupFirestoreWorkspace, addToast]
  );

  const resetPasswordForEmail = useCallback(
    async (email: string, newPassword?: string): Promise<string> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }

      const emailKey = getEmailAccountKey(cleanEmail);
      const acctRef = doc(db, 'accounts', emailKey);

      let firestoreAcctExists = false;
      let acctData: {
        accountId: string;
        userId: string;
        name: string;
        email: string;
        passwordHash: string;
        createdAt?: unknown;
      } | null = null;

      try {
        const snap = await getDoc(acctRef);
        if (snap.exists()) {
          firestoreAcctExists = true;
          acctData = snap.data() as typeof acctData;
        }
      } catch {
        // ignore
      }

      const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
      const accountIdx = accounts.findIndex((a) => a.email.toLowerCase() === cleanEmail);

      if (!firestoreAcctExists && accountIdx === -1) {
        throw new Error('No account found with this email address. Please create an account first.');
      }

      if (newPassword !== undefined) {
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }

        if (firestoreAcctExists && acctData) {
          try {
            await setDoc(acctRef, {
              accountId: emailKey,
              userId: acctData.userId,
              name: acctData.name,
              email: cleanEmail,
              passwordHash: newPassword,
              createdAt: acctData.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore
          }
        }

        if (accountIdx !== -1) {
          accounts[accountIdx] = {
            ...accounts[accountIdx],
            passwordHash: newPassword,
          };
          localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
        }

        return `Password for ${cleanEmail} has been updated! You can now sign in with your new password on any device.`;
      }

      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch {
        // ignore
      }
      return `Password reset instructions initiated for ${cleanEmail}.`;
    },
    []
  );

  const logoutUser = useCallback(async () => {
    clearFirestoreListeners();
    localStorage.removeItem(LOCAL_SESSION_KEY);
    try {
      await signOut(auth);
    } catch {
      // ignore signOut error
    }
    setIsAuthenticated(false);
    setIsFirestoreBacked(false);
    setUserProfile(null);
    setMeters([]);
    setMonths([]);
    setReadings([]);
    setNotifications([]);
    setAuditLogs([]);
    setSelectedMeterId(null);
    setActivePage('dashboard');
  }, [clearFirestoreListeners]);

  const deleteCurrentAccount = useCallback(async () => {
    if (!userProfile) return;
    const targetUserId = userProfile.userId;
    const targetEmail = userProfile.email.toLowerCase();

    if (isFirestoreBacked) {
      await purgeFirestoreUserCollections(targetUserId);
      try {
        await deleteDoc(doc(db, 'users', targetUserId));
      } catch {
        // ignore
      }
      if (targetEmail) {
        try {
          await deleteDoc(doc(db, 'accounts', getEmailAccountKey(targetEmail)));
        } catch {
          // ignore
        }
      }
    }

    // Remove workspace and account from local registry
    localStorage.removeItem(getWorkspaceKey(targetUserId));
    localStorage.removeItem(LOCAL_SESSION_KEY);
    try {
      const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
      const filtered = accounts.filter(
        (a) => a.userId !== targetUserId && a.email.toLowerCase() !== targetEmail
      );
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }

    await logoutUser();
  }, [userProfile, isFirestoreBacked, purgeFirestoreUserCollections, logoutUser]);

  // Meter & Reading Operations
  const addMeter = useCallback(
    async (input: {
      meterName: string;
      meterNumber: string;
      consumerId?: string;
      referenceNumber?: string;
      ownerName?: string;
      location: string;
      provider: string;
      iconType: MeterIconType;
      monthlyLimit: number;
      estimatedRate: number;
      fixedCharges?: number;
      initialReading: number;
    }): Promise<ElectricityMeter> => {
      if (!userProfile) throw new Error('User not authenticated');

      const meterId = sanitizeId(`meter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const todayStr = '2026-10-09';
      const currentMonthId = '2026-10';
      const opening = Math.max(0, Number(input.initialReading) || 0);
      const limit = Math.max(1, Number(input.monthlyLimit) || 500);
      const rate = Math.max(0, Number(input.estimatedRate) || 35);
      const fixed = Math.max(0, Number(input.fixedCharges) || 100);

      const serialNo = input.meterName.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_METER_NAME_LEN);
      const meterNo = (input.meterNumber.trim() || 'N/A').slice(
        0,
        VALIDATION_CONSTRAINTS.MAX_METER_NUMBER_LEN
      );
      const consumerIdVal = (input.consumerId?.trim() || 'N/A').slice(0, 80);
      const refNoVal = (input.referenceNumber?.trim() || meterNo || 'N/A').slice(0, 80);
      const owner = (input.ownerName?.trim() || userProfile.name || 'User').slice(0, 100);

      const newMeter: ElectricityMeter = {
        meterId,
        userId: userProfile.userId,
        meterName: serialNo,
        meterNumber: meterNo,
        consumerId: consumerIdVal,
        referenceNumber: refNoVal,
        ownerName: owner,
        location: input.location.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_LOCATION_LEN),
        provider: (input.provider.trim() || 'LESCO').slice(0, VALIDATION_CONSTRAINTS.MAX_PROVIDER_LEN),
        iconType: input.iconType || 'home',
        monthlyLimit: limit,
        estimatedRate: rate,
        fixedCharges: fixed,
        additionalCharges: 0,
        taxPercentage: 0,
        currentMonthId,
        openingReading: opening,
        previousReading: opening,
        previousReadingDate: todayStr,
        currentReading: opening,
        lastReadingDate: todayStr,
        unitsConsumed: 0,
        lastClosingReading: opening,
        lastAlertThreshold: 0,
        lastAlertSentAt: '',
        isActive: true,
        isArchived: false,
      };

      const newMonth: MonthlyRecord = {
        monthId: currentMonthId,
        meterId,
        userId: userProfile.userId,
        meterName: newMeter.meterName,
        meterNumber: newMeter.meterNumber,
        openingReading: opening,
        currentReading: opening,
        closingReading: opening,
        unitsConsumed: 0,
        monthlyLimitSnapshot: limit,
        estimatedRateSnapshot: rate,
        fixedChargesSnapshot: fixed,
        estimatedCost: fixed,
        status: 'active',
        readingsCount: 1,
      };

      const initialReadingDoc: MeterReading = {
        readingId: sanitizeId(`read-${Date.now()}`),
        meterId,
        monthId: currentMonthId,
        userId: userProfile.userId,
        readingValue: opening,
        previousReadingValue: opening,
        unitsSincePreviousReading: 0,
        totalMonthUnits: 0,
        readingDate: todayStr,
        note: 'Initial meter opening reading',
        isRolloverOrCorrection: false,
      };

      if (isFirestoreBacked) {
        const batch = writeBatch(db);
        const mRef = doc(db, 'users', userProfile.userId, 'meters', meterId);
        const moRef = doc(db, 'users', userProfile.userId, 'meters', meterId, 'months', currentMonthId);
        const rRef = doc(
          db,
          'users',
          userProfile.userId,
          'meters',
          meterId,
          'months',
          currentMonthId,
          'readings',
          initialReadingDoc.readingId
        );

        batch.set(mRef, {
          ...newMeter,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(moRef, {
          ...newMonth,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(rRef, {
          ...initialReadingDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userProfile.userId}/meters/${meterId}`);
        }
      } else {
        setMeters((prev) => [...prev, newMeter]);
        setMonths((prev) => [...prev, newMonth]);
        setReadings((prev) => [...prev, initialReadingDoc]);
      }

      setSelectedMeterId(meterId);

      await createNotificationInternal({
        meterId,
        meterName: newMeter.meterName,
        monthId: currentMonthId,
        type: 'meter_added',
        category: 'system',
        title: `${newMeter.meterName} meter added`,
        message: `Meter ${newMeter.meterName} (${newMeter.meterNumber}) registered for owner ${owner}.`,
        threshold: 0,
      });

      return newMeter;
    },
    [userProfile, isFirestoreBacked, createNotificationInternal]
  );

  const updateMeter = useCallback(
    async (
      meterId: string,
      updates: Partial<
        Pick<
          ElectricityMeter,
          | 'meterName'
          | 'meterNumber'
          | 'consumerId'
          | 'referenceNumber'
          | 'ownerName'
          | 'location'
          | 'provider'
          | 'iconType'
          | 'monthlyLimit'
          | 'estimatedRate'
          | 'fixedCharges'
          | 'additionalCharges'
          | 'taxPercentage'
          | 'isActive'
          | 'isArchived'
        >
      >
    ) => {
      if (!userProfile) return;
      const existingMeter = meters.find((m) => m.meterId === meterId);
      if (!existingMeter) return;

      const updatedMeter: ElectricityMeter = {
        ...existingMeter,
        meterName:
          updates.meterName !== undefined
            ? updates.meterName.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_METER_NAME_LEN)
            : existingMeter.meterName,
        meterNumber:
          updates.meterNumber !== undefined
            ? updates.meterNumber.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_METER_NUMBER_LEN)
            : existingMeter.meterNumber,
        consumerId:
          updates.consumerId !== undefined
            ? updates.consumerId.trim().slice(0, 80)
            : existingMeter.consumerId || 'N/A',
        referenceNumber:
          updates.referenceNumber !== undefined
            ? updates.referenceNumber.trim().slice(0, 80)
            : existingMeter.referenceNumber || existingMeter.meterNumber || 'N/A',
        ownerName:
          updates.ownerName !== undefined
            ? updates.ownerName.trim().slice(0, 100)
            : existingMeter.ownerName,
        location:
          updates.location !== undefined
            ? updates.location.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_LOCATION_LEN)
            : existingMeter.location,
        provider:
          updates.provider !== undefined
            ? updates.provider.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_PROVIDER_LEN)
            : existingMeter.provider,
        iconType: updates.iconType ?? existingMeter.iconType,
        monthlyLimit:
          updates.monthlyLimit !== undefined
            ? Math.max(1, Number(updates.monthlyLimit))
            : existingMeter.monthlyLimit,
        estimatedRate:
          updates.estimatedRate !== undefined
            ? Math.max(0, Number(updates.estimatedRate))
            : existingMeter.estimatedRate,
        fixedCharges:
          updates.fixedCharges !== undefined
            ? Math.max(0, Number(updates.fixedCharges))
            : existingMeter.fixedCharges,
        additionalCharges:
          updates.additionalCharges !== undefined
            ? Math.max(0, Number(updates.additionalCharges))
            : existingMeter.additionalCharges,
        taxPercentage:
          updates.taxPercentage !== undefined
            ? Math.max(0, Math.min(100, Number(updates.taxPercentage)))
            : existingMeter.taxPercentage,
        isActive: updates.isActive ?? existingMeter.isActive,
        isArchived: updates.isArchived ?? existingMeter.isArchived,
      };

      const pct = calculateUsagePercentage(updatedMeter.unitsConsumed, updatedMeter.monthlyLimit);
      const thresholdInfo = analyzeConsumptionThreshold(pct);
      updatedMeter.lastAlertThreshold = thresholdInfo.threshold;

      if (isFirestoreBacked) {
        const mPath = `users/${userProfile.userId}/meters/${meterId}`;
        try {
          await updateDoc(doc(db, 'users', userProfile.userId, 'meters', meterId), {
            meterName: updatedMeter.meterName,
            meterNumber: updatedMeter.meterNumber,
            consumerId: updatedMeter.consumerId || 'N/A',
            referenceNumber: updatedMeter.referenceNumber || 'N/A',
            ownerName: updatedMeter.ownerName || 'User',
            location: updatedMeter.location,
            provider: updatedMeter.provider,
            iconType: updatedMeter.iconType,
            monthlyLimit: updatedMeter.monthlyLimit,
            estimatedRate: updatedMeter.estimatedRate,
            fixedCharges: updatedMeter.fixedCharges,
            additionalCharges: updatedMeter.additionalCharges,
            taxPercentage: updatedMeter.taxPercentage,
            isActive: updatedMeter.isActive,
            isArchived: updatedMeter.isArchived,
            lastAlertThreshold: updatedMeter.lastAlertThreshold,
            lastAlertSentAt: updatedMeter.lastAlertSentAt,
            updatedAt: serverTimestamp(),
          });

          // Also sync active month snapshot
          const activeMonth = months.find(
            (mo) => mo.meterId === meterId && mo.monthId === updatedMeter.currentMonthId && mo.status === 'active'
          );
          if (activeMonth) {
            const bill = calculateEstimatedBill(
              updatedMeter.unitsConsumed,
              updatedMeter.estimatedRate,
              updatedMeter.fixedCharges,
              updatedMeter.additionalCharges,
              updatedMeter.taxPercentage
            );
            await updateDoc(
              doc(db, 'users', userProfile.userId, 'meters', meterId, 'months', activeMonth.monthId),
              {
                meterName: updatedMeter.meterName,
                meterNumber: updatedMeter.meterNumber,
                monthlyLimitSnapshot: updatedMeter.monthlyLimit,
                estimatedRateSnapshot: updatedMeter.estimatedRate,
                fixedChargesSnapshot: updatedMeter.fixedCharges,
                estimatedCost: bill.totalEstimatedBill,
                updatedAt: serverTimestamp(),
              }
            );
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, mPath);
        }
      } else {
        setMeters((prev) => prev.map((m) => (m.meterId === meterId ? updatedMeter : m)));
        setMonths((prev) =>
          prev.map((mo) => {
            if (mo.meterId === meterId && mo.monthId === updatedMeter.currentMonthId && mo.status === 'active') {
              const bill = calculateEstimatedBill(
                updatedMeter.unitsConsumed,
                updatedMeter.estimatedRate,
                updatedMeter.fixedCharges,
                updatedMeter.additionalCharges,
                updatedMeter.taxPercentage
              );
              return {
                ...mo,
                meterName: updatedMeter.meterName,
                meterNumber: updatedMeter.meterNumber,
                monthlyLimitSnapshot: updatedMeter.monthlyLimit,
                estimatedRateSnapshot: updatedMeter.estimatedRate,
                fixedChargesSnapshot: updatedMeter.fixedCharges,
                estimatedCost: bill.totalEstimatedBill,
              };
            }
            return mo;
          })
        );
      }

      addToast('Meter Updated', `${updatedMeter.meterName} settings have been saved.`, 'success');
    },
    [userProfile, meters, months, isFirestoreBacked, addToast]
  );

  const deleteMeter = useCallback(
    async (meterId: string) => {
      if (!userProfile) return;
      const target = meters.find((m) => m.meterId === meterId);
      if (!target) return;

      if (isFirestoreBacked) {
        const path = `users/${userProfile.userId}/meters/${meterId}`;
        try {
          await deleteDoc(doc(db, 'users', userProfile.userId, 'meters', meterId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setMeters((prev) => prev.filter((m) => m.meterId !== meterId));
        setMonths((prev) => prev.filter((mo) => mo.meterId !== meterId));
        setReadings((prev) => prev.filter((r) => r.meterId !== meterId));
      }
      addToast('Meter Removed', `${target.meterName} has been removed.`, 'info');
    },
    [userProfile, meters, isFirestoreBacked, addToast]
  );

  const recordReading = useCallback(
    async (input: {
      meterId: string;
      readingValue: number;
      readingDate: string;
      note?: string;
      isRolloverOrCorrection?: boolean;
    }) => {
      if (!userProfile) throw new Error('User not authenticated');
      const meter = meters.find((m) => m.meterId === input.meterId);
      if (!meter) throw new Error('Selected meter not found');

      const isCorrection = Boolean(input.isRolloverOrCorrection);
      const validation = validateReadingEntry(
        meter.openingReading,
        meter.currentReading,
        input.readingValue,
        isCorrection
      );
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Prevent accidental identical duplicate reading on same date unless correction
      if (
        !isCorrection &&
        input.readingValue === meter.currentReading &&
        input.readingDate === meter.lastReadingDate
      ) {
        throw new Error(
          `Reading ${input.readingValue.toLocaleString()} on ${input.readingDate} was already saved for ${meter.meterName}.`
        );
      }

      const newUnitsConsumed = calculateUnitsConsumed(meter.openingReading, input.readingValue);
      const unitsSincePrev = Math.max(0, Math.round((input.readingValue - meter.currentReading) * 100) / 100);
      const pct = calculateUsagePercentage(newUnitsConsumed, meter.monthlyLimit);
      const alertDecision = shouldDispatchThresholdAlert(
        pct,
        meter.lastAlertThreshold,
        meter.lastAlertSentAt,
        userProfile.quietHoursStart,
        userProfile.quietHoursEnd
      );

      const nowIso = new Date().toISOString();
      const newAlertThreshold = Math.max(meter.lastAlertThreshold, alertDecision.analysis.threshold);
      const newAlertSentAt = alertDecision.shouldSend ? nowIso : meter.lastAlertSentAt;

      const readingId = sanitizeId(`read-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const newReadingDoc: MeterReading = {
        readingId,
        meterId: meter.meterId,
        monthId: meter.currentMonthId,
        userId: userProfile.userId,
        readingValue: input.readingValue,
        previousReadingValue: meter.currentReading,
        unitsSincePreviousReading: unitsSincePrev,
        totalMonthUnits: newUnitsConsumed,
        readingDate: input.readingDate.slice(0, 30),
        note: (input.note || 'Meter reading entry').slice(0, VALIDATION_CONSTRAINTS.MAX_NOTE_LEN),
        isRolloverOrCorrection: isCorrection,
      };

      const bill = calculateEstimatedBill(
        newUnitsConsumed,
        meter.estimatedRate,
        meter.fixedCharges,
        meter.additionalCharges,
        meter.taxPercentage
      );

      const existingMonth = months.find(
        (mo) => mo.meterId === meter.meterId && mo.monthId === meter.currentMonthId
      );
      const updatedReadingsCount = (existingMonth?.readingsCount || 1) + 1;

      if (isFirestoreBacked) {
        const batch = writeBatch(db);
        const mRef = doc(db, 'users', userProfile.userId, 'meters', meter.meterId);
        const moRef = doc(
          db,
          'users',
          userProfile.userId,
          'meters',
          meter.meterId,
          'months',
          meter.currentMonthId
        );
        const rRef = doc(
          db,
          'users',
          userProfile.userId,
          'meters',
          meter.meterId,
          'months',
          meter.currentMonthId,
          'readings',
          readingId
        );

        batch.update(mRef, {
          previousReading: meter.currentReading,
          previousReadingDate: meter.lastReadingDate,
          currentReading: input.readingValue,
          lastReadingDate: input.readingDate,
          unitsConsumed: newUnitsConsumed,
          lastAlertThreshold: newAlertThreshold,
          lastAlertSentAt: newAlertSentAt,
          updatedAt: serverTimestamp(),
        });

        if (existingMonth) {
          batch.update(moRef, {
            currentReading: input.readingValue,
            closingReading: input.readingValue,
            unitsConsumed: newUnitsConsumed,
            estimatedCost: bill.totalEstimatedBill,
            readingsCount: updatedReadingsCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(moRef, {
            monthId: meter.currentMonthId,
            meterId: meter.meterId,
            userId: userProfile.userId,
            meterName: meter.meterName,
            meterNumber: meter.meterNumber,
            openingReading: meter.openingReading,
            currentReading: input.readingValue,
            closingReading: input.readingValue,
            unitsConsumed: newUnitsConsumed,
            monthlyLimitSnapshot: meter.monthlyLimit,
            estimatedRateSnapshot: meter.estimatedRate,
            fixedChargesSnapshot: meter.fixedCharges,
            estimatedCost: bill.totalEstimatedBill,
            status: 'active',
            readingsCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        batch.set(rRef, {
          ...newReadingDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isCorrection) {
          const logId = sanitizeId(`audit-${Date.now()}`);
          const aRef = doc(db, 'users', userProfile.userId, 'auditLogs', logId);
          batch.set(aRef, {
            logId,
            userId: userProfile.userId,
            meterId: meter.meterId,
            monthId: meter.currentMonthId,
            action: 'READING_ADJUSTMENT',
            previousValue: `${meter.currentReading}`,
            newValue: `${input.readingValue}`,
            reason: (input.note || 'Manual reading correction').slice(0, 300),
            createdAt: serverTimestamp(),
          });
        }

        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userProfile.userId}/meters/${meter.meterId}`);
        }
      } else {
        setMeters((prev) =>
          prev.map((m) =>
            m.meterId === meter.meterId
              ? {
                  ...m,
                  previousReading: meter.currentReading,
                  previousReadingDate: meter.lastReadingDate,
                  currentReading: input.readingValue,
                  lastReadingDate: input.readingDate,
                  unitsConsumed: newUnitsConsumed,
                  lastAlertThreshold: newAlertThreshold,
                  lastAlertSentAt: newAlertSentAt,
                }
              : m
          )
        );
        setMonths((prev) =>
          prev.map((mo) =>
            mo.meterId === meter.meterId && mo.monthId === meter.currentMonthId
              ? {
                  ...mo,
                  currentReading: input.readingValue,
                  closingReading: input.readingValue,
                  unitsConsumed: newUnitsConsumed,
                  estimatedCost: bill.totalEstimatedBill,
                  readingsCount: updatedReadingsCount,
                }
              : mo
          )
        );
        setReadings((prev) => [...prev, newReadingDoc]);

        if (isCorrection) {
          setAuditLogs((prev) => [
            {
              logId: sanitizeId(`audit-${Date.now()}`),
              userId: userProfile.userId,
              meterId: meter.meterId,
              monthId: meter.currentMonthId,
              action: 'READING_ADJUSTMENT',
              previousValue: `${meter.currentReading}`,
              newValue: `${input.readingValue}`,
              reason: (input.note || 'Manual reading correction').slice(0, 300),
              timestampIso: nowIso,
            },
            ...prev,
          ]);
        }
      }

      // Trigger threshold notification if a threshold was crossed
      if (alertDecision.shouldSend && alertDecision.analysis.notificationType) {
        const remaining = Math.max(0, meter.monthlyLimit - newUnitsConsumed);
        await createNotificationInternal({
          meterId: meter.meterId,
          meterName: meter.meterName,
          monthId: meter.currentMonthId,
          type: alertDecision.analysis.notificationType,
          category: 'alert',
          title: `${meter.meterName} meter ${alertDecision.analysis.statusLabel.toLowerCase()} (${pct}%)`,
          message: `${pct}% of your monthly limit has been used on ${meter.meterName} (${newUnitsConsumed.toLocaleString()} / ${meter.monthlyLimit.toLocaleString()} units, ${remaining.toLocaleString()} remaining).`,
          threshold: alertDecision.analysis.threshold,
        });
      } else {
        addToast(
          'Reading Saved',
          `${meter.meterName}: ${input.readingValue.toLocaleString()} (${newUnitsConsumed.toLocaleString()} units consumed, ${pct}% of limit)`,
          'success'
        );
      }
    },
    [userProfile, meters, months, isFirestoreBacked, createNotificationInternal, addToast]
  );

  const correctReadingEntry = useCallback(
    async (input: { readingId: string; newReadingValue: number; reason: string }) => {
      if (!userProfile) return;
      const targetReading = readings.find((r) => r.readingId === input.readingId);
      if (!targetReading) throw new Error('Reading entry not found');

      const meter = meters.find((m) => m.meterId === targetReading.meterId);
      if (!meter) throw new Error('Meter not found');

      if (input.newReadingValue < meter.openingReading) {
        throw new Error(
          `Corrected reading (${input.newReadingValue.toLocaleString()}) cannot be below the month's opening reading (${meter.openingReading.toLocaleString()}).`
        );
      }

      await recordReading({
        meterId: meter.meterId,
        readingValue: input.newReadingValue,
        readingDate: targetReading.readingDate,
        note: `Correction: ${input.reason}`,
        isRolloverOrCorrection: true,
      });
    },
    [userProfile, readings, meters, recordReading]
  );

  // Core Feature: Start New Month (for All Active Meters or Selected Meters)
  const startNewMonth = useCallback(
    async (input: {
      targetMonthId: string;
      meterIds: string[];
      closingOverrides?: Record<string, number>;
    }) => {
      if (!userProfile) throw new Error('User not authenticated');
      if (!VALIDATION_CONSTRAINTS.MONTH_ID_REGEX.test(input.targetMonthId)) {
        throw new Error('Invalid month format. Expected YYYY-MM.');
      }

      const selectedMeters = meters.filter((m) => input.meterIds.includes(m.meterId));
      if (selectedMeters.length === 0) {
        throw new Error('Please select at least one meter to start the new month.');
      }

      // Prevent duplicate month start
      const alreadyOnTarget = selectedMeters.filter((m) => m.currentMonthId === input.targetMonthId);
      if (alreadyOnTarget.length > 0) {
        throw new Error(
          `${alreadyOnTarget.map((m) => m.meterName).join(', ')} already started ${formatMonthLabel(
            input.targetMonthId
          )}. Cannot start the same month twice.`
        );
      }

      const startDayStr = `${input.targetMonthId}-01`;
      const nowIso = new Date().toISOString();

      if (isFirestoreBacked) {
        const batch = writeBatch(db);

        for (const meter of selectedMeters) {
          const finalClosing =
            input.closingOverrides?.[meter.meterId] !== undefined
              ? Math.max(meter.openingReading, Number(input.closingOverrides[meter.meterId]))
              : meter.currentReading;
          const finalUnits = calculateUnitsConsumed(meter.openingReading, finalClosing);
          const finalBill = calculateEstimatedBill(
            finalUnits,
            meter.estimatedRate,
            meter.fixedCharges,
            meter.additionalCharges,
            meter.taxPercentage
          );

          // 1. Finalize previous month record
          const prevMonthRef = doc(
            db,
            'users',
            userProfile.userId,
            'meters',
            meter.meterId,
            'months',
            meter.currentMonthId
          );
          batch.update(prevMonthRef, {
            currentReading: finalClosing,
            closingReading: finalClosing,
            unitsConsumed: finalUnits,
            estimatedCost: finalBill.totalEstimatedBill,
            status: 'finalized',
            updatedAt: serverTimestamp(),
          });

          // 2. Create new monthly record with opening = previous closing
          const newMonthRef = doc(
            db,
            'users',
            userProfile.userId,
            'meters',
            meter.meterId,
            'months',
            input.targetMonthId
          );
          batch.set(newMonthRef, {
            monthId: input.targetMonthId,
            meterId: meter.meterId,
            userId: userProfile.userId,
            meterName: meter.meterName,
            meterNumber: meter.meterNumber,
            openingReading: finalClosing,
            currentReading: finalClosing,
            closingReading: finalClosing,
            unitsConsumed: 0,
            monthlyLimitSnapshot: meter.monthlyLimit,
            estimatedRateSnapshot: meter.estimatedRate,
            fixedChargesSnapshot: meter.fixedCharges,
            estimatedCost: meter.fixedCharges,
            status: 'active',
            readingsCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // 3. Create initial opening reading entry in the new month
          const openReadingId = sanitizeId(`read-open-${input.targetMonthId}-${meter.meterId.slice(-6)}`);
          const openReadingRef = doc(
            db,
            'users',
            userProfile.userId,
            'meters',
            meter.meterId,
            'months',
            input.targetMonthId,
            'readings',
            openReadingId
          );
          batch.set(openReadingRef, {
            readingId: openReadingId,
            meterId: meter.meterId,
            monthId: input.targetMonthId,
            userId: userProfile.userId,
            readingValue: finalClosing,
            previousReadingValue: finalClosing,
            unitsSincePreviousReading: 0,
            totalMonthUnits: 0,
            readingDate: startDayStr,
            note: `Opening reading carried forward from ${meter.currentMonthId}`,
            isRolloverOrCorrection: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // 4. Update meter state for the new month
          const meterRef = doc(db, 'users', userProfile.userId, 'meters', meter.meterId);
          batch.update(meterRef, {
            currentMonthId: input.targetMonthId,
            lastClosingReading: finalClosing,
            openingReading: finalClosing,
            previousReading: finalClosing,
            previousReadingDate: startDayStr,
            currentReading: finalClosing,
            lastReadingDate: startDayStr,
            unitsConsumed: 0,
            lastAlertThreshold: 0,
            lastAlertSentAt: '',
            updatedAt: serverTimestamp(),
          });

          // 5. Log audit trail
          const logId = sanitizeId(`audit-month-${input.targetMonthId}-${meter.meterId.slice(-6)}`);
          const auditRef = doc(db, 'users', userProfile.userId, 'auditLogs', logId);
          batch.set(auditRef, {
            logId,
            userId: userProfile.userId,
            meterId: meter.meterId,
            monthId: input.targetMonthId,
            action: 'START_NEW_MONTH',
            previousValue: `${meter.currentMonthId} closed at ${finalClosing} (${finalUnits} units)`,
            newValue: `${input.targetMonthId} opened at ${finalClosing} (0 units, limit ${meter.monthlyLimit})`,
            reason: 'Monthly cycle rollover',
            createdAt: serverTimestamp(),
          });
        }

        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userProfile.userId}/meters`);
        }
      } else {
        const newMonthsToAdd: MonthlyRecord[] = [];
        const newReadingsToAdd: MeterReading[] = [];
        const newAuditsToAdd: AuditLog[] = [];

        setMeters((prev) =>
          prev.map((meter) => {
            if (!input.meterIds.includes(meter.meterId)) return meter;
            const finalClosing =
              input.closingOverrides?.[meter.meterId] !== undefined
                ? Math.max(meter.openingReading, Number(input.closingOverrides[meter.meterId]))
                : meter.currentReading;
            const finalUnits = calculateUnitsConsumed(meter.openingReading, finalClosing);

            newMonthsToAdd.push({
              monthId: input.targetMonthId,
              meterId: meter.meterId,
              userId: userProfile.userId,
              meterName: meter.meterName,
              meterNumber: meter.meterNumber,
              openingReading: finalClosing,
              currentReading: finalClosing,
              closingReading: finalClosing,
              unitsConsumed: 0,
              monthlyLimitSnapshot: meter.monthlyLimit,
              estimatedRateSnapshot: meter.estimatedRate,
              fixedChargesSnapshot: meter.fixedCharges,
              estimatedCost: meter.fixedCharges,
              status: 'active',
              readingsCount: 1,
            });

            newReadingsToAdd.push({
              readingId: sanitizeId(`read-open-${input.targetMonthId}-${meter.meterId.slice(-6)}`),
              meterId: meter.meterId,
              monthId: input.targetMonthId,
              userId: userProfile.userId,
              readingValue: finalClosing,
              previousReadingValue: finalClosing,
              unitsSincePreviousReading: 0,
              totalMonthUnits: 0,
              readingDate: startDayStr,
              note: `Opening reading carried forward from ${meter.currentMonthId}`,
              isRolloverOrCorrection: false,
            });

            newAuditsToAdd.push({
              logId: sanitizeId(`audit-month-${input.targetMonthId}-${meter.meterId.slice(-6)}`),
              userId: userProfile.userId,
              meterId: meter.meterId,
              monthId: input.targetMonthId,
              action: 'START_NEW_MONTH',
              previousValue: `${meter.currentMonthId} closed at ${finalClosing} (${finalUnits} units)`,
              newValue: `${input.targetMonthId} opened at ${finalClosing} (0 units, limit ${meter.monthlyLimit})`,
              reason: 'Monthly cycle rollover',
              timestampIso: nowIso,
            });

            return {
              ...meter,
              currentMonthId: input.targetMonthId,
              lastClosingReading: finalClosing,
              openingReading: finalClosing,
              previousReading: finalClosing,
              previousReadingDate: startDayStr,
              currentReading: finalClosing,
              lastReadingDate: startDayStr,
              unitsConsumed: 0,
              lastAlertThreshold: 0,
              lastAlertSentAt: '',
            };
          })
        );

        setMonths((prev) => [
          ...prev.map((mo) => {
            const matchedMeter = selectedMeters.find(
              (m) => m.meterId === mo.meterId && m.currentMonthId === mo.monthId
            );
            if (!matchedMeter) return mo;
            const finalClosing =
              input.closingOverrides?.[matchedMeter.meterId] !== undefined
                ? Math.max(matchedMeter.openingReading, Number(input.closingOverrides[matchedMeter.meterId]))
                : matchedMeter.currentReading;
            const finalUnits = calculateUnitsConsumed(matchedMeter.openingReading, finalClosing);
            const finalBill = calculateEstimatedBill(
              finalUnits,
              matchedMeter.estimatedRate,
              matchedMeter.fixedCharges,
              matchedMeter.additionalCharges,
              matchedMeter.taxPercentage
            );
            return {
              ...mo,
              currentReading: finalClosing,
              closingReading: finalClosing,
              unitsConsumed: finalUnits,
              estimatedCost: finalBill.totalEstimatedBill,
              status: 'finalized' as const,
            };
          }),
          ...newMonthsToAdd,
        ]);

        setReadings((prev) => [...prev, ...newReadingsToAdd]);
        setAuditLogs((prev) => [...newAuditsToAdd, ...prev]);
      }

      // Send notification for new month start
      const firstMeter = selectedMeters[0];
      await createNotificationInternal({
        meterId: firstMeter.meterId,
        meterName: selectedMeters.length === 1 ? firstMeter.meterName : `${selectedMeters.length} Meters`,
        monthId: input.targetMonthId,
        type: 'month_started',
        category: 'system',
        title: `New month started: ${formatMonthLabel(input.targetMonthId)}`,
        message: `Finalized previous month and reset consumption to 0 for ${selectedMeters
          .map((m) => m.meterName)
          .join(', ')}. Remember to log your next reading!`,
        threshold: 0,
      });
    },
    [userProfile, meters, isFirestoreBacked, createNotificationInternal]
  );

  const correctHistoricalMonthRecord = useCallback(
    async (input: {
      meterId: string;
      monthId: string;
      newOpeningReading: number;
      newClosingReading: number;
      reason: string;
    }) => {
      if (!userProfile) return;
      if (input.newClosingReading < input.newOpeningReading) {
        throw new Error('Closing reading cannot be less than opening reading.');
      }
      if (!input.reason.trim()) {
        throw new Error('Please provide an audit reason for modifying a historical record.');
      }

      const targetMonth = months.find(
        (mo) => mo.meterId === input.meterId && mo.monthId === input.monthId
      );
      if (!targetMonth) throw new Error('Historical month record not found');

      const newUnits = calculateUnitsConsumed(input.newOpeningReading, input.newClosingReading);
      const newBill = calculateEstimatedBill(
        newUnits,
        targetMonth.estimatedRateSnapshot,
        targetMonth.fixedChargesSnapshot
      );

      const logId = sanitizeId(`audit-hist-${Date.now()}`);
      const auditEntry: AuditLog = {
        logId,
        userId: userProfile.userId,
        meterId: input.meterId,
        monthId: input.monthId,
        action: 'HISTORICAL_RECORD_CORRECTION',
        previousValue: `Open: ${targetMonth.openingReading}, Close: ${targetMonth.closingReading} (${targetMonth.unitsConsumed} units)`,
        newValue: `Open: ${input.newOpeningReading}, Close: ${input.newClosingReading} (${newUnits} units)`,
        reason: input.reason.trim().slice(0, 300),
        timestampIso: new Date().toISOString(),
      };

      if (isFirestoreBacked) {
        const aPath = `users/${userProfile.userId}/auditLogs/${logId}`;
        try {
          const { timestampIso, ...auditPayload } = auditEntry;
          await setDoc(doc(db, 'users', userProfile.userId, 'auditLogs', logId), {
            ...auditPayload,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, aPath);
        }
      } else {
        setAuditLogs((prev) => [auditEntry, ...prev]);
      }

      // Update local state view of historical record
      setMonths((prev) =>
        prev.map((mo) =>
          mo.meterId === input.meterId && mo.monthId === input.monthId
            ? {
                ...mo,
                openingReading: input.newOpeningReading,
                closingReading: input.newClosingReading,
                currentReading: input.newClosingReading,
                unitsConsumed: newUnits,
                estimatedCost: newBill.totalEstimatedBill,
              }
            : mo
        )
      );

      addToast(
        'Historical Correction Logged',
        `Updated ${targetMonth.meterName} (${input.monthId}) and recorded entry in the immutable Audit Trail.`,
        'success'
      );
    },
    [userProfile, months, isFirestoreBacked, addToast]
  );

  const updateUserProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!userProfile) return;
      const updated: UserProfile = {
        ...userProfile,
        name:
          updates.name !== undefined
            ? updates.name.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_NAME_LEN)
            : userProfile.name,
        email:
          updates.email !== undefined
            ? updates.email.trim().slice(0, VALIDATION_CONSTRAINTS.MAX_EMAIL_LEN)
            : userProfile.email,
        currency: updates.currency ?? userProfile.currency,
        timezone: updates.timezone ?? userProfile.timezone,
        inAppNotifications: updates.inAppNotifications ?? userProfile.inAppNotifications,
        browserPushNotifications:
          updates.browserPushNotifications ?? userProfile.browserPushNotifications,
        emailNotifications: updates.emailNotifications ?? userProfile.emailNotifications,
        quietHoursStart: updates.quietHoursStart ?? userProfile.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd ?? userProfile.quietHoursEnd,
        readingReminderDays:
          updates.readingReminderDays !== undefined
            ? Math.max(1, Math.min(30, Number(updates.readingReminderDays)))
            : userProfile.readingReminderDays,
        setupCompleted: updates.setupCompleted ?? userProfile.setupCompleted,
      };

      if (isFirestoreBacked) {
        const path = `users/${userProfile.userId}`;
        try {
          await updateDoc(doc(db, 'users', userProfile.userId), {
            name: updated.name,
            email: updated.email,
            currency: updated.currency,
            timezone: updated.timezone,
            inAppNotifications: updated.inAppNotifications,
            browserPushNotifications: updated.browserPushNotifications,
            emailNotifications: updated.emailNotifications,
            quietHoursStart: updated.quietHoursStart,
            quietHoursEnd: updated.quietHoursEnd,
            readingReminderDays: updated.readingReminderDays,
            setupCompleted: updated.setupCompleted,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setUserProfile(updated);
        try {
          const rawAccounts = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
          const accounts: LocalAccountRecord[] = rawAccounts ? JSON.parse(rawAccounts) : [];
          const updatedAccounts = accounts.map((a) =>
            a.userId === updated.userId
              ? { ...a, name: updated.name, email: updated.email.toLowerCase() }
              : a
          );
          localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
          localStorage.setItem(
            LOCAL_SESSION_KEY,
            JSON.stringify({
              userId: updated.userId,
              name: updated.name,
              email: updated.email.toLowerCase(),
            })
          );
        } catch {
          // ignore
        }
      }

      addToast('Settings Saved', 'Your account and notification preferences have been updated.', 'success');
    },
    [userProfile, isFirestoreBacked, addToast]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string, isRead: boolean = true) => {
      if (!userProfile) return;
      if (isFirestoreBacked) {
        const path = `users/${userProfile.userId}/notifications/${notificationId}`;
        try {
          await updateDoc(doc(db, 'users', userProfile.userId, 'notifications', notificationId), {
            isRead,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead } : n))
        );
      }
    },
    [userProfile, isFirestoreBacked]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!userProfile) return;
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    if (isFirestoreBacked) {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'users', userProfile.userId, 'notifications', n.notificationId), {
          isRead: true,
          updatedAt: serverTimestamp(),
        });
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.userId}/notifications`);
      }
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
    addToast('Notifications Updated', 'All notifications marked as read.', 'info');
  }, [userProfile, notifications, isFirestoreBacked, addToast]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!userProfile) return;
      if (isFirestoreBacked) {
        const path = `users/${userProfile.userId}/notifications/${notificationId}`;
        try {
          await deleteDoc(doc(db, 'users', userProfile.userId, 'notifications', notificationId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setNotifications((prev) => prev.filter((n) => n.notificationId !== notificationId));
      }
    },
    [userProfile, isFirestoreBacked]
  );

  const triggerDeviceTestNotification = useCallback(async () => {
    const firstMeter = meters[0];
    const meterLabel = firstMeter ? `${firstMeter.meterName} (${firstMeter.meterNumber})` : 'WattWise Alerts';
    const messageBody = firstMeter
      ? `Current consumption is ${firstMeter.unitsConsumed} / ${firstMeter.monthlyLimit} units (${calculateUsagePercentage(
          firstMeter.unitsConsumed,
          firstMeter.monthlyLimit
        )}%). Device notification bar delivery is active!`
      : 'Device notification bar delivery is active for your WattWise account.';

    const sentToOsBar = await sendDeviceNotification(
      `⚡ WattWise: ${meterLabel}`,
      messageBody
    );

    if (sentToOsBar) {
      addToast(
        'Device Notification Dispatched',
        `Sent alert to your device notification bar!`,
        'success'
      );
    } else {
      addToast(
        'In-App Alert Dispatched',
        `Alert shown in-app. Grant browser notification permission to also display in your OS notification bar.`,
        'info'
      );
    }
  }, [meters, addToast]);

  const clearAllUserData = useCallback(async () => {
    if (!userProfile) return;
    if (isFirestoreBacked) {
      await purgeFirestoreUserCollections(userProfile.userId);
    }
    setMeters([]);
    setMonths([]);
    setReadings([]);
    setNotifications([]);
    setAuditLogs([]);
    setSelectedMeterId(null);
    persistLocalWorkspace(userProfile.userId, {
      profile: userProfile,
      meters: [],
      months: [],
      readings: [],
      notifications: [],
      auditLogs: [],
    });
    addToast('All Data Deleted', 'All meters, readings, and notifications have been deleted.', 'info');
  }, [userProfile, isFirestoreBacked, purgeFirestoreUserCollections, persistLocalWorkspace, addToast]);

  return (
    <WattWiseContext.Provider
      value={{
        isAuthReady,
        isLoadingData,
        isAuthenticated,
        isFirestoreBacked,
        firebaseConsoleNotice,
        dismissFirebaseConsoleNotice: () => setFirebaseConsoleNotice(null),
        userProfile,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        resetPasswordForEmail,
        logoutUser,
        deleteCurrentAccount,
        activePage,
        setActivePage,
        selectedMeterId,
        setSelectedMeterId,
        editingMeter,
        setEditingMeter,
        showSetupWizard,
        setShowSetupWizard,
        toasts,
        dismissToast,
        addToast,
        meters,
        months,
        readings,
        notifications,
        auditLogs,
        addMeter,
        updateMeter,
        deleteMeter,
        recordReading,
        correctReadingEntry,
        startNewMonth,
        correctHistoricalMonthRecord,
        updateUserProfile,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        triggerDeviceTestNotification,
        clearAllUserData,
      }}
    >
      {children}
    </WattWiseContext.Provider>
  );
};

export function useWattWise(): WattWiseContextValue {
  const ctx = useContext(WattWiseContext);
  if (!ctx) {
    throw new Error('useWattWise must be used within a WattWiseProvider');
  }
  return ctx;
}
