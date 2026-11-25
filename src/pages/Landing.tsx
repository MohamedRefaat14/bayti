import { go } from '../router'
import { session } from '../state'
import { BuildArt, FinishArt, FurnishArt } from '../components/Art'

const CARDS = [
  { id: 'build', title: 'صمّم وابنِ من الصفر', Art: BuildArt, cta: 'ابدأ التصميم من الصفر',
    text: 'اكتب مقاسات أرضك، ارسم التخطيط، وشوف بيتك بيكبر من الأساس للمفروش' },
  { id: 'finish', title: 'شطّب شقتك', Art: FinishArt, cta: 'ابدأ التشطيب فوراً', featured: true,
    text: 'عندك شقة وعايز تشطبها؟ دخل مقاسات الغرف واختار الألوان، الأرضيات، والأسقف وشوفها 360°' },
  { id: 'furnish', title: 'افرش بيتك', Art: FurnishArt, cta: 'ابدأ تأثيث بيتك',
    text: 'شقتك متشطبة وجاهزة؟ اختار الغرف ودخل مقاساتها وابدأ فرشها وتنسيق ألوان العفش 360°' },
]

export default function Landing() {
  return (
    <main className="container">
      <section className="hero">
        <h1>ابدأ من الخطوة اللي تناسبك</h1>
        <p>مش لازم تبدأ من الصفر. اختار الخدمة اللي محتاجها لبيتك دلوقتي ودوس ابدأ</p>
      </section>
      <section className="cards">
        {CARDS.map(({ id, title, Art, cta, text, featured }) => (
          <article key={id} className={'card' + (featured ? ' featured' : '')}>
            {featured && <span className="badge">الأكثر استخداماً</span>}
            <div className="art"><Art /></div>
            <h2>{title}</h2>
            <p>{text}</p>
            <button className="cta" onClick={() => { session.mode = id as typeof session.mode; go('plan') }}><span aria-hidden>👉</span>{cta}</button>
          </article>
        ))}
      </section>
      <section className="perks">
        <span><b className="tick">✓</b>بدون تنزيل برامج</span>
        <span><b className="tick">✓</b>تقدير فوري للتكلفة</span>
        <span><b className="tick">✓</b>معاينة 360° واقعية</span>
      </section>
    </main>
  )
}
