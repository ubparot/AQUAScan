import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { addDoc, collection, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

export type ControlAuthUser = {
  uid: string
  email: string
  name: string
  photoURL?: string
  providerId: 'password' | 'google.com' | string
}

export type ControlAuthState = {
  ready: boolean
  user: ControlAuthUser | null
  error?: string
}

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredFirebaseKeys: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId', 'appId']
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export const allowedControlIdentities = parseAllowedIdentities(import.meta.env.VITE_AQUASCAN_ALLOWED_EMAILS)

export function getControlAuthSetupIssues() {
  const missingConfig = requiredFirebaseKeys.filter((key) => !String(firebaseConfig[key] ?? '').trim())
  const issues: string[] = []

  if (missingConfig.length > 0) {
    issues.push(`Missing Firebase env vars: ${missingConfig.map((key) => envNameForFirebaseKey(key)).join(', ')}`)
  }

  if (allowedControlIdentities.length === 0) {
    issues.push('Missing VITE_AQUASCAN_ALLOWED_EMAILS allowlist')
  }

  return issues
}

export function isControlAuthConfigured() {
  return getControlAuthSetupIssues().length === 0
}

export function isEmailAllowed(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return false

  return allowedControlIdentities.some((identity) => {
    if (identity.startsWith('@')) return normalizedEmail.endsWith(identity)
    return normalizedEmail === identity
  })
}

export function subscribeToControlAuth(onChange: (state: ControlAuthState) => void) {
  if (!isControlAuthConfigured()) {
    onChange({ ready: true, user: null, error: 'Firebase authentication is not configured.' })
    return () => undefined
  }

  const auth = getFirebaseAuth()
  return onAuthStateChanged(
    auth,
    async (firebaseUser) => {
      if (!firebaseUser) {
        onChange({ ready: true, user: null })
        return
      }

      if (!isEmailAllowed(firebaseUser.email)) {
        await signOut(auth)
        onChange({ ready: true, user: null, error: 'This account is not allowed to use live control.' })
        return
      }

      const user = toControlAuthUser(firebaseUser)
      await upsertControlUser(firebaseUser)
      onChange({ ready: true, user })
    },
    () => onChange({ ready: true, user: null, error: 'Unable to read Google sign-in state.' }),
  )
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth()
  const result = await signInWithPopup(auth, provider)

  if (!isEmailAllowed(result.user.email)) {
    await signOut(auth)
    throw new Error('This account is not allowed to use live control.')
  }

  await recordControlSignIn(result.user)
  return toControlAuthUser(result.user)
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth()
  const result = await signInWithEmailAndPassword(auth, email.trim(), password)

  if (!isEmailAllowed(result.user.email)) {
    await signOut(auth)
    throw new Error('This account is not allowed to use live control.')
  }

  await recordControlSignIn(result.user)
  return toControlAuthUser(result.user)
}

export async function createEmailAccount(email: string, password: string, displayName: string) {
  const auth = getFirebaseAuth()
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password)

  if (displayName.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() })
  }

  if (!isEmailAllowed(result.user.email)) {
    await signOut(auth)
    throw new Error('Account created, but this email is not in the AQUAScan control allowlist yet.')
  }

  await recordControlSignIn(result.user)
  return toControlAuthUser(result.user)
}

export async function sendEmailPasswordReset(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim())
}

export async function signOutOfGoogle() {
  if (!isControlAuthConfigured()) return
  await signOut(getFirebaseAuth())
}

export async function getCurrentFirebaseIdToken() {
  if (!isControlAuthConfigured()) return undefined
  const user = getFirebaseAuth().currentUser
  return user ? user.getIdToken() : undefined
}

function getFirebaseAuth() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  return getAuth(app)
}

function getFirebaseDatabase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  return getFirestore(app)
}

function toControlAuthUser(user: User): ControlAuthUser {
  const providerId = user.providerData[0]?.providerId ?? 'password'
  return {
    uid: user.uid,
    email: user.email ?? '',
    name: user.displayName ?? user.email ?? 'Google user',
    photoURL: user.photoURL ?? undefined,
    providerId,
  }
}

async function recordControlSignIn(user: User) {
  const db = getFirebaseDatabase()
  const controlUser = toControlAuthUser(user)
  const now = serverTimestamp()
  await upsertControlUser(user)

  await addDoc(collection(db, 'controlSessions'), {
    uid: user.uid,
    email: controlUser.email,
    providerId: controlUser.providerId,
    signedInAt: now,
    userAgent: navigator.userAgent,
  })
}

async function upsertControlUser(user: User) {
  const db = getFirebaseDatabase()
  const controlUser = toControlAuthUser(user)
  const now = serverTimestamp()

  await setDoc(
    doc(db, 'controlUsers', user.uid),
    {
      uid: user.uid,
      email: controlUser.email,
      name: controlUser.name,
      photoURL: controlUser.photoURL ?? null,
      providerId: controlUser.providerId,
      allowed: isEmailAllowed(user.email),
      lastSeenAt: now,
      updatedAt: now,
    },
    { merge: true },
  )
}

function parseAllowedIdentities(value: string | undefined) {
  return (value ?? '')
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function envNameForFirebaseKey(key: keyof FirebaseOptions) {
  switch (key) {
    case 'apiKey':
      return 'VITE_FIREBASE_API_KEY'
    case 'authDomain':
      return 'VITE_FIREBASE_AUTH_DOMAIN'
    case 'projectId':
      return 'VITE_FIREBASE_PROJECT_ID'
    case 'appId':
      return 'VITE_FIREBASE_APP_ID'
    default:
      return String(key)
  }
}
