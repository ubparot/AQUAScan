import { lazy, Suspense } from 'react'
import { ControlAuthGate } from './ControlAuthGate'
import { useNavigate } from './navigation'

const App = lazy(() => import('../App'))

export default function ControlRoute() {
  const navigate = useNavigate()

  return (
    <div className="control-route">
      <ControlAuthGate>
        {(logout, user) => (
          <>
            <div className="control-actions" aria-label="Control dashboard actions">
              <span className="control-user">
                {user.photoURL && <img src={user.photoURL} alt="" />}
                <span>{user.email}</span>
              </span>
              <button className="control-chip" type="button" onClick={() => navigate('home')}>AquaLabs site</button>
              <button className="control-chip" type="button" onClick={logout}>Log out</button>
            </div>
            <Suspense fallback={<div className="route-loading" />}>
              <App />
            </Suspense>
          </>
        )}
      </ControlAuthGate>
    </div>
  )
}
