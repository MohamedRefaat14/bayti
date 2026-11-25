import { go } from '../router'

export default function Header() {
  return (
    <header className="nav">
      <div className="container">
        <a className="logo" href="#" onClick={(e) => { e.preventDefault(); go('') }}>بيتي</a>
        <nav className="nav-links">
          <a href="#projects">مشاريعي</a>
          <a href="#gallery">معرض التصاميم</a>
          <a href="#about">عن الموقع</a>
          <a href="#help">المساعدة</a>
        </nav>
      </div>
    </header>
  )
}