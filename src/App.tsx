import { Fragment, useEffect, useState } from 'react'
import Header from './components/Header'
import StepBar from './components/StepBar'
import Landing from './pages/Landing'
import Plan from './pages/Plan'
import Style from './pages/Style'
import Viewer from './pages/Viewer'
import Admin from './pages/Admin'
import Summary from './pages/Summary'
import Projects from './pages/Projects'
import Stub from './pages/Stub'
import { onProject } from './project'
import { session } from './state'
import { useRoute } from './router'

export default function App() {
  const route = useRoute()
  const [rev, setRev] = useState(session.rev)
  useEffect(() => onProject(() => setRev(session.rev)), []) // لما مشروع يتفتح الصفحات بتتبني من جديد
  const known = ['', 'plan', 'style', 'viewer', 'admin', 'summary', 'projects']
  return (
    <>
      <Header />
      <Fragment key={rev}>
        {route === '' && <Landing />}
        {route === 'plan' && <Plan />}
        {route === 'style' && <Style />}
        {route === 'viewer' && <Viewer />}
        {route === 'admin' && <Admin />}
        {route === 'summary' && <Summary />}
        {route === 'projects' && <Projects />}
        {!known.includes(route) && <Stub route={route} />}
      </Fragment>
      {route !== '' && route !== 'admin' && route !== 'projects' && <StepBar route={route} />}
    </>
  )
}