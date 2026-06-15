import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronUp,
  ClipboardCheck,
  Gauge,
  FileText,
  Mail,
  MapPin,
  Menu,
  Phone,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Wrench,
  X,
  Zap
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

function currentRoute() {
  const baseUrl = basePath.replace(/\/$/, '');
  let path = window.location.pathname;
  if (baseUrl && baseUrl !== '/' && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length) || '/';
  }
  return path.replace(/\/$/, '') || '/';
}

const navItems = [
  { label: 'Home', href: routePath('/'), path: '/' },
  { label: 'About', href: routePath('/about'), path: '/about' },
  { label: 'Services', href: routePath('/services'), path: '/services' },
  { label: 'Careers', href: routePath('/careers'), path: '/careers' },
  { label: 'Contact', href: routePath('/contact'), path: '/contact' }
];

const summaryCards = [
  {
    title: 'Fleet Maintenance',
    text: 'Scheduled maintenance plans that help business vehicles stay ready for daily routes.',
    icon: ShieldCheck
  },
  {
    title: 'Commercial Vehicle Repair',
    text: 'Practical repairs for vans, light trucks, and company vehicles used in daily operations.',
    icon: Wrench
  },
  {
    title: 'Diagnostics',
    text: 'Clear troubleshooting for drivability, engine, electrical, and warning light concerns.',
    icon: Gauge
  },
  {
    title: 'Preventive Maintenance',
    text: 'Oil, fluid, brake, inspection, and safety checks focused on avoiding avoidable downtime.',
    icon: ClipboardCheck
  }
];

const services = [
  {
    title: 'Fleet maintenance',
    icon: ShieldCheck,
    text: 'Routine maintenance coordination for company vehicles, including mileage-based service planning.'
  },
  {
    title: 'Commercial vehicle repair',
    icon: Wrench,
    text: 'Repair support for work vans, trucks, and business vehicles used by local operators.'
  },
  {
    title: 'Preventive maintenance',
    icon: ClipboardCheck,
    text: 'Fluid checks, filters, inspections, tire checks, and scheduled service to reduce downtime.'
  },
  {
    title: 'Brake service',
    icon: CheckCircle2,
    text: 'Brake inspection, pad and rotor service, hydraulic checks, and safety-focused repair.'
  },
  {
    title: 'Suspension and steering repair',
    icon: Sparkles,
    text: 'Diagnosis and repair for handling, ride quality, steering, and suspension component concerns.'
  },
  {
    title: 'Engine diagnostics',
    icon: Stethoscope,
    text: 'Diagnostic support for check-engine lights, drivability issues, and performance problems.'
  },
  {
    title: 'Electrical diagnostics',
    icon: Zap,
    text: 'Testing for battery, charging, wiring, lighting, accessory, and electronic control issues.'
  },
  {
    title: 'DOT/inspection support',
    icon: ClipboardCheck,
    text: 'Inspection readiness support and documentation-minded service for commercial vehicle needs.'
  }
];

const faqs = [
  {
    question: 'Do I need an account or login to view job postings?',
    answer: 'No. The Careers page is public and available without a login.'
  },
  {
    question: 'Does this site connect to a fleet, inventory, or admin system?',
    answer: 'No. This is a standalone public company website.'
  },
  {
    question: 'Can the job posting be printed for recruitment records?',
    answer: 'Yes. The Careers page includes a printable posting layout and a Print Posting button.'
  },
  {
    question: 'What area does the business serve?',
    answer: 'Scarsdale Auto Repair, Inc. is based in Mount Vernon, NY and supports commercial and fleet customers in the area.'
  }
];

const testimonials = [
  'Reliable communication and practical support for commercial vehicle maintenance.',
  'Professional service for vehicles that need to stay ready for daily business use.',
  'A straightforward repair partner for diagnostics, maintenance, and inspection readiness.'
];

const processSteps = [
  {
    title: 'Request',
    text: 'Share the vehicle concern, service need, or maintenance request.'
  },
  {
    title: 'Review',
    text: 'The issue is reviewed with practical diagnostics and clear service priorities.'
  },
  {
    title: 'Service',
    text: 'Repair or maintenance work is completed with attention to safety and reliability.'
  },
  {
    title: 'Return',
    text: 'Vehicles are prepared for return to daily commercial operation.'
  }
];

function Header({ activePath }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [activePath]);

  return (
    <header className="site-header">
      <a className="brand" href={routePath('/')} onClick={() => setOpen(false)}>
        <span className="brand-mark" aria-hidden="true">
          <Wrench size={20} />
        </span>
        <span>{company}</span>
      </a>
      <button
        className="nav-toggle-button"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
      <nav className={`nav-links ${open ? 'is-open' : ''}`} aria-label="Primary navigation">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            aria-current={activePath === item.path ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
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

function ButtonLink({ children, href, variant = 'primary' }) {
  return (
    <a className={`button ${variant}`} href={href}>
      {children}
    </a>
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
            <ButtonLink href={routePath('/contact')}>Request Service</ButtonLink>
            <ButtonLink href={routePath('/careers')} variant="secondary">View Careers</ButtonLink>
            <ButtonLink href={routePath('/contact')} variant="ghost">Contact Us</ButtonLink>
          </div>
        </div>
      </section>

      <SummaryCards />
      <AboutContent />
      <ServicesContent preview />
      <TestimonialsSection />
      <CareersPreview />
      <FaqSection />
      <ContactSection compact />
    </>
  );
}

function SummaryCards() {
  return (
    <section className="section summary-band" aria-label="Business summary">
      <div className="summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="summary-card" key={card.title}>
              <Icon size={24} aria-hidden="true" />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <>
      <PageTitle eyebrow="About Us" title={`About ${company}`}>
        Based in {city}, serving commercial and fleet customers with dependable repair and maintenance support.
      </PageTitle>
      <AboutContent />
      <TestimonialsSection />
      <ContactCta />
    </>
  );
}

function ServicesPage() {
  return (
    <>
      <PageTitle
        eyebrow="Services"
        title="Fleet and Commercial Vehicle Services"
        actions={<ButtonLink href={routePath('/contact')}>Request Service</ButtonLink>}
      >
        Repair, diagnostics, maintenance, and inspection support for business vehicles.
      </PageTitle>
      <ServicesContent />
      <ServiceProcess />
      <FaqSection />
      <ContactCta />
    </>
  );
}

function ContactPage() {
  return (
    <>
      <PageTitle
        eyebrow="Contact"
        title={company}
        actions={<ButtonLink href={`mailto:${email}`} variant="outline">Email Us</ButtonLink>}
      >
        Request service information or contact the Mount Vernon, NY office.
      </PageTitle>
      <ContactSection />
      <FaqSection />
    </>
  );
}

function PageTitle({ eyebrow, title, children, actions }) {
  return (
    <section className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {actions && <div className="page-title-actions">{actions}</div>}
    </section>
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

function ServicesContent({ preview = false }) {
  const visibleServices = preview ? services.slice(0, 4) : services;

  return (
    <section className="section services-band">
      <div className="section-heading">
        <p className="eyebrow">Services</p>
        <h2>Commercial repair and maintenance capabilities</h2>
        {!preview && (
          <p>
            Organized service support for commercial vehicles, fleet operators, and small businesses
            that need practical maintenance, diagnostics, and repair coordination.
          </p>
        )}
      </div>
      <div className="service-grid">
        {visibleServices.map((service) => {
          const Icon = service.icon;
          return (
            <article className="service-card" key={service.title}>
              <Icon size={24} aria-hidden="true" />
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          );
        })}
      </div>
      {preview && (
        <div className="section-action">
          <ButtonLink href={routePath('/services')} variant="outline">View All Services</ButtonLink>
        </div>
      )}
    </section>
  );
}

function ServiceProcess() {
  return (
    <section className="section process-band">
      <div className="section-heading">
        <p className="eyebrow">How Service Works</p>
        <h2>A simple process for business vehicle needs</h2>
      </div>
      <div className="process-grid">
        {processSteps.map((step, index) => (
          <article className="process-step" key={step.title}>
            <span>{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CareersPreview() {
  return (
    <section className="section careers-preview">
      <div>
        <p className="eyebrow">Careers</p>
        <h2>Public career opportunities</h2>
        <p>
          Current job postings are available on the public Careers page. No login or account is required
          to view posted positions.
        </p>
      </div>
      <ButtonLink href={routePath('/careers')}>Open Careers Page</ButtonLink>
    </section>
  );
}

function CareersPage() {
  return (
    <>
      <PageTitle eyebrow="Public Posting" title="Careers">
        Open positions with {company} are posted below for public review and recruitment documentation.
      </PageTitle>

      <main className="job-wrap">
        <article className="job-posting" aria-labelledby="systems-administrator-title">
          <div className="recruitment-note">
            <FileText size={18} aria-hidden="true" />
            <span>Public recruitment posting. This page is accessible without login and formatted for screenshot or print records.</span>
          </div>

          <div className="job-header">
            <div>
              <p className="eyebrow">Job Posting</p>
              <h2 id="systems-administrator-title">Systems Administrator</h2>
            </div>
            <div className="job-actions">
              <button className="print-button" type="button" onClick={() => window.print()}>
                <Printer size={18} aria-hidden="true" />
                Print Posting
              </button>
              <a className="button primary" href={`mailto:${email}?subject=Systems Administrator Application`}>
                <Mail size={18} aria-hidden="true" />
                Apply by Email
              </a>
            </div>
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
              resume to: <a href={`mailto:${email}`}><strong>{email}</strong></a>
            </p>
          </section>
        </article>
      </main>
    </>
  );
}

function ContactSection({ compact = false }) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  }

  return (
    <section className={`section contact-band ${compact ? 'is-compact' : ''}`} id="contact">
      <div className="contact-layout">
        <div>
          <p className="eyebrow">Contact</p>
          <h2>{compact ? company : 'Request Service Information'}</h2>
          <div className="contact-list">
            <p><MapPin size={19} aria-hidden="true" /> {city}</p>
            <a href={`tel:${phone}`}><Phone size={19} aria-hidden="true" /> {phone}</a>
            <a href={`mailto:${email}`}><Mail size={19} aria-hidden="true" /> {email}</a>
          </div>
        </div>

        {!compact && (
          <form className="contact-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input name="name" type="text" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Service Needed
              <select name="service" defaultValue="">
                <option value="" disabled>Select a service</option>
                {services.map((service) => (
                  <option key={service.title} value={service.title}>{service.title}</option>
                ))}
              </select>
            </label>
            <label className="form-wide">
              Message
              <textarea name="message" rows="5" required />
            </label>
            <button className="button primary form-wide" type="submit">Submit Request</button>
            {submitted && (
              <p className="form-success" role="status">Thank you. Your request has been received.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="section testimonials-band">
      <div className="section-heading">
        <p className="eyebrow">Reviews</p>
        <h2>Professional support for business vehicles</h2>
      </div>
      <div className="testimonial-grid">
        {testimonials.map((quote) => (
          <figure className="testimonial-card" key={quote}>
            <div aria-hidden="true">
              {[0, 1, 2, 3, 4].map((star) => <Star key={star} size={17} fill="currentColor" />)}
            </div>
            <blockquote>{quote}</blockquote>
            <figcaption>Commercial customer review</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section faq-band">
      <div className="section-heading">
        <p className="eyebrow">FAQ</p>
        <h2>Common questions</h2>
      </div>
      <div className="faq-list">
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
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
        <p>Use the Contact page for the company location, phone placeholder, email placeholder, and request form.</p>
      </div>
      <ButtonLink href={routePath('/contact')}>Contact Us</ButtonLink>
    </section>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 520);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      className={`back-to-top ${visible ? 'is-visible' : ''}`}
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUp size={22} />
    </button>
  );
}

function App() {
  const [activePath, setActivePath] = useState(currentRoute);
  const pages = useMemo(() => ({
    '/': <HomePage />,
    '/about': <AboutPage />,
    '/services': <ServicesPage />,
    '/careers': <CareersPage />,
    '/contact': <ContactPage />
  }), []);

  useEffect(() => {
    function syncRoute() {
      setActivePath(currentRoute());
    }
    function handleInternalLink(event) {
      if (!(event.target instanceof Element)) {
        return;
      }
      const link = event.target.closest('a');
      if (!link || link.target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }
      const baseUrl = basePath.replace(/\/$/, '');
      const isSiteRoute = navItems.some((item) => url.pathname === new URL(item.href, window.location.href).pathname);
      if (!isSiteRoute || url.pathname === window.location.pathname) {
        return;
      }
      event.preventDefault();
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActivePath(currentRoute());
      if (baseUrl && !url.pathname.startsWith(baseUrl)) {
        setActivePath('/');
      }
    }
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('click', handleInternalLink);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('click', handleInternalLink);
    };
  }, []);

  return (
    <div>
      <Header activePath={activePath} />
      {pages[activePath] || <HomePage />}
      <Footer />
      <BackToTop />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
