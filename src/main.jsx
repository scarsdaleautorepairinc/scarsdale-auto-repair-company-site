import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Mail,
  MapPin,
  Menu,
  Phone,
  Printer,
  Wrench
} from 'lucide-react';
import './styles.css';

const company = 'Scarsdale Auto Repair, Inc.';
const city = 'Mount Vernon, NY';
const phone = '[phone placeholder]';
const email = '[company email placeholder]';
const postingDate = 'June 14, 2026';
const basePath = import.meta.env.BASE_URL;

function routePath(path) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${path.replace(/^\//, '')}`;
}

const navItems = [
  { label: 'Home', href: routePath('/') },
  { label: 'About', href: routePath('/about') },
  { label: 'Services', href: routePath('/services') },
  { label: 'Careers', href: routePath('/careers') },
  { label: 'Contact', href: routePath('/contact') }
];

const services = [
  'Fleet maintenance',
  'Commercial vehicle repair',
  'Preventive maintenance',
  'Diagnostics',
  'Brake service',
  'Suspension and steering repair',
  'Engine and electrical diagnostics',
  'DOT/inspection support'
];

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href={routePath('/')}>
        <span className="brand-mark" aria-hidden="true">
          <Wrench size={20} />
        </span>
        <span>{company}</span>
      </a>
      <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label="Toggle navigation" />
      <label className="nav-toggle-label" htmlFor="nav-toggle">
        <Menu size={24} />
      </label>
      <nav className="nav-links" aria-label="Primary navigation">
        {navItems.map((item) => (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>{company}</strong>
        <span>{city}</span>
      </div>
      <p>&copy; {new Date().getFullYear()} {company}. All rights reserved.</p>
    </footer>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Commercial Vehicle Repair and Fleet Maintenance</p>
          <h1>{company}</h1>
          <p>
            Professional auto repair, commercial diagnostics, fleet service, and preventive maintenance
            for businesses operating in and around Mount Vernon, New York.
          </p>
          <div className="hero-actions">
            <a className="button primary" href={routePath('/services')}>View Services</a>
            <a className="button secondary" href={routePath('/careers')}>Careers</a>
          </div>
        </div>
      </section>

      <AboutContent />

      <ServicesContent />

      <section className="section careers-preview">
        <div>
          <p className="eyebrow">Careers</p>
          <h2>Public career opportunities</h2>
          <p>
            Current job postings are available on the public Careers page. No login or account is required
            to view posted positions.
          </p>
        </div>
        <a className="button primary" href={routePath('/careers')}>Open Careers Page</a>
      </section>

      <ContactSection />
    </>
  );
}

function AboutPage() {
  return (
    <>
      <section className="page-title">
        <p className="eyebrow">About Us</p>
        <h1>About {company}</h1>
        <p>Based in {city}, serving commercial and fleet customers.</p>
      </section>
      <AboutContent />
      <ContactCta />
    </>
  );
}

function ServicesPage() {
  return (
    <>
      <section className="page-title">
        <p className="eyebrow">Services</p>
        <h1>Fleet and Commercial Vehicle Services</h1>
        <p>Repair, diagnostics, maintenance, and inspection support for business vehicles.</p>
      </section>
      <ServicesContent />
      <ContactCta />
    </>
  );
}

function ContactPage() {
  return (
    <>
      <section className="page-title">
        <p className="eyebrow">Contact</p>
        <h1>{company}</h1>
        <p>Contact information for the Mount Vernon, NY office.</p>
      </section>
      <ContactSection />
    </>
  );
}

function AboutContent() {
  return (
    <section className="section two-column">
        <div>
          <p className="eyebrow">About Us</p>
          <h2>Dependable service for commercial and fleet customers.</h2>
        </div>
        <div className="section-copy">
          <p>
            {company} is based in {city} and supports commercial vehicle operators, local businesses,
            and fleet customers with practical repair and maintenance services.
          </p>
          <p>
            The company focuses on clear diagnostics, preventive maintenance, and dependable repair work
            that helps vehicles stay safe, compliant, and ready for daily operation.
          </p>
        </div>
    </section>
  );
}

function ServicesContent() {
  return (
    <section className="section services-band">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h2>Commercial repair and maintenance capabilities</h2>
        </div>
        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service}>
              <ClipboardCheck size={22} aria-hidden="true" />
              <h3>{service}</h3>
            </article>
          ))}
        </div>
    </section>
  );
}

function CareersPage() {
  return (
    <>
      <section className="page-title">
        <p className="eyebrow">Public Posting</p>
        <h1>Careers</h1>
        <p>Open positions with {company} are posted below for public review.</p>
      </section>

      <main className="job-wrap">
        <article className="job-posting" aria-labelledby="systems-administrator-title">
          <div className="job-header">
            <div>
              <p className="eyebrow">Job Posting</p>
              <h2 id="systems-administrator-title">Systems Administrator</h2>
            </div>
            <button className="print-button" type="button" onClick={() => window.print()}>
              <Printer size={18} aria-hidden="true" />
              Print
            </button>
          </div>

          <dl className="job-details">
            <div>
              <dt><Building2 size={17} aria-hidden="true" /> Employer</dt>
              <dd>{company}</dd>
            </div>
            <div>
              <dt><MapPin size={17} aria-hidden="true" /> Location</dt>
              <dd>{city}</dd>
            </div>
            <div>
              <dt><BriefcaseBusiness size={17} aria-hidden="true" /> Job Type</dt>
              <dd>Full-time</dd>
            </div>
            <div>
              <dt><CalendarDays size={17} aria-hidden="true" /> Posting Date</dt>
              <dd>{postingDate}</dd>
            </div>
          </dl>

          <section className="job-section">
            <h3>Job Duties</h3>
            <ul>
              <li>Administer, monitor, and maintain company computer systems, workstations, and network resources.</li>
              <li>Support business software, user accounts, security settings, data backups, and system access controls.</li>
              <li>Troubleshoot hardware, software, connectivity, and equipment issues for office and operations staff.</li>
              <li>Coordinate technology vendors, maintain system documentation, and assist with technology planning.</li>
              <li>Help improve reliability, security, and efficiency of information systems used in daily operations.</li>
            </ul>
          </section>

          <section className="job-section">
            <h3>Requirements</h3>
            <ul>
              <li>Relevant education, training, or professional experience in systems administration or information technology.</li>
              <li>Knowledge of computer hardware, operating systems, networking, cybersecurity basics, and user support practices.</li>
              <li>Ability to document procedures, communicate clearly, and manage multiple support requests responsibly.</li>
              <li>Experience supporting small business technology environments is preferred.</li>
            </ul>
          </section>

          <section className="job-section application">
            <h3>Application Instructions</h3>
            <p>
              Qualified applicants should submit a resume for consideration. To apply, please email your
              resume to: <strong>{email}</strong>
            </p>
          </section>
        </article>
      </main>
    </>
  );
}

function ContactSection() {
  return (
    <section className="section contact-band" id="contact">
      <div className="section-heading">
        <p className="eyebrow">Contact</p>
        <h2>{company}</h2>
      </div>
      <div className="contact-list">
        <p><MapPin size={19} aria-hidden="true" /> {city}</p>
        <p><Phone size={19} aria-hidden="true" /> {phone}</p>
        <p><Mail size={19} aria-hidden="true" /> {email}</p>
      </div>
    </section>
  );
}

function ContactCta() {
  return (
    <section className="section careers-preview">
      <div>
        <p className="eyebrow">Contact</p>
        <h2>Need service information?</h2>
        <p>Use the Contact page for the company location, phone placeholder, and email placeholder.</p>
      </div>
      <a className="button primary" href={routePath('/contact')}>Contact Us</a>
    </section>
  );
}

function App() {
  const baseUrl = basePath.replace(/\/$/, '');
  let path = window.location.pathname;
  if (baseUrl && baseUrl !== '/' && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length) || '/';
  }
  path = path.replace(/\/$/, '') || '/';
  const pages = {
    '/': <HomePage />,
    '/about': <AboutPage />,
    '/services': <ServicesPage />,
    '/careers': <CareersPage />,
    '/contact': <ContactPage />
  };

  return (
    <div>
      <Header />
      {pages[path] || <HomePage />}
      <Footer />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
