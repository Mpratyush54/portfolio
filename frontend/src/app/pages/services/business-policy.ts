import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

const policies: Record<
  string,
  { title: string; intro: string; sections: { title: string; text: string }[] }
> = {
  terms: {
    title: 'Terms of service',
    intro:
      'These terms explain the professional software development and technical consulting services offered by Pratyush Mishra through pratyushes.dev.',
    sections: [
      {
        title: 'Services and project scope',
        text: 'Services include business websites, backend/API development, DevOps deployment, AWS reviews and technical consultations. Package fees apply only to the listed deliverables and limits. Additional requirements require a written quotation accepted before work begins. Third-party hosting, domain, API and licence charges are separate unless expressly included.',
      },
      {
        title: 'Quotation and acceptance',
        text: 'Project-specific quotations identify the provider, client, scope, acceptance criteria, exclusions, timelines, taxes, total payable amount and complete agreement. SRS files, when attached, form part of that revision. Review the full agreement before accepting it in the private portal. Acceptance is recorded with the entered name, invited email, timestamp and agreement fingerprint; it is not a certified digital signature. Acceptance alone does not charge the client.',
      },
      {
        title: 'Project payments',
        text: 'The standard schedule is 25% before onboarding, 25% after MVP delivery and approval, 40% after development completion and approval, and 10% after deployment and approval. Cumulative payments are 25%, 50%, 90% and 100%. No future instalment is automatically debited. The written project agreement states the final payment triggers and applicable tax treatment.',
      },
      {
        title: 'Consultations',
        text: 'A technical consultation is a paid 30-minute session for requirements discussion, technical advice and a high-level action plan. It does not include development, implementation or a detailed SRS, and does not guarantee project work, employment or a commercial outcome. The displayed slot fee is confirmed before payment. Sending a project enquiry is free and does not require a paid consultation.',
      },
      {
        title: 'Review, handover and support',
        text: 'Deliveries are reviewed against the accepted scope. New features and scope changes are separately quoted. Project-specific source and handover are provided after full payment as set out in the agreement. Included defect support lasts 30 calendar days from the recorded production deployment and covers failures against the accepted scope. New features, third-party outages and ongoing operations are outside that support unless separately agreed.',
      },
      {
        title: 'Payment activation and contact',
        text: 'Online checkout is currently pending payment-gateway activation. Service information, prices and project enquiries remain available. Questions about scope, quotations or terms can be sent to developer@pratyushes.dev. Mandatory statutory rights are preserved.',
      },
    ],
  },
  refunds: {
    title: 'Cancellation and refunds',
    intro:
      'Contact developer@pratyushes.dev with your booking or quotation reference to request cancellation, rescheduling or a refund. Do not include payment credentials.',
    sections: [
      {
        title: 'Technical consultation bookings',
        text: 'Cancel or request rescheduling at least 24 hours before the scheduled session by email. Cancellations inside 24 hours, no-shows and partial attendance after the session starts are not refundable under the consultation booking terms, subject to mandatory rights. The cancellation request and any applicable refund are confirmed in writing.',
      },
      {
        title: 'Provider cancellation or missed consultation',
        text: 'If the provider cancels or misses the consultation, a full refund is initiated within 5–7 business days. Bank and payment-provider processing may take additional time. Refunds normally return through the original payment method.',
      },
      {
        title: 'Project cancellation',
        text: 'Project cancellation follows the accepted quotation. Completed and accepted work remains payable. Unperformed work, unused advances and approved non-recoverable third-party costs are reconciled in writing; there is no blanket rule that every advance is non-refundable. No new unapproved work or charges accrue after the agreed termination date.',
      },
      {
        title: 'Project refund timeline',
        text: 'Any agreed project refund is initiated within 7 business days after reconciliation and confirmation of the payment reference. Bank/payment-provider processing can take longer. Cancellation does not trigger an automatic refund in the portal. Disputed or duplicate charges should be reported promptly so the payment record can be checked.',
      },
      {
        title: 'Current checkout status',
        text: 'Online payments remain disabled pending payment-gateway activation. An enquiry, quotation preview or agreement acceptance does not by itself create a payment or charge.',
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro:
      'Pratyush Mishra uses information submitted through this website to respond to enquiries and administer consultations and software development projects.',
    sections: [
      {
        title: 'Information you provide',
        text: 'Project enquiries may include your name, email, optional phone number and message. Consultation bookings include the requested time and contact details. Private project quotations may include requirements, SRS files, scope, acceptance records and milestone payment references. Do not submit passwords, API secrets or unnecessary sensitive production data in public forms.',
      },
      {
        title: 'How information is used',
        text: 'Information is used to answer enquiries, prepare quotations, deliver services, send relevant booking/project communications, confirm payments, maintain required records and resolve disputes. Project details are not automatically published as portfolio work; any publicity permission follows the accepted agreement.',
      },
      {
        title: 'Analytics',
        text: 'The website uses PostHog for limited anonymous public-page and contact/booking event analytics. The integration excludes contact-form contents, private proposals and admin pages; session recordings and autocapture are disabled. URLs are normalised and query strings are removed. The configured SDK respects Do Not Track and uses memory-only anonymous identity. Browser blockers can prevent collection.',
      },
      {
        title: 'Payments and service providers',
        text: 'When enabled, Razorpay processes checkout credentials. This website stores payment references and verified status, not card details. Hosting, database and email providers process the information needed to operate the service. Access is limited to what is required for those tasks.',
      },
      {
        title: 'Retention and requests',
        text: 'Information is retained as needed for service delivery, required accounting/legal records and dispute resolution. Access, correction or deletion requests can be sent to developer@pratyushes.dev. Deletion is subject to applicable record-retention obligations and cannot always be immediate.',
      },
    ],
  },
  delivery: {
    title: 'Service delivery',
    intro:
      'All offers on this website are professional digital services. No physical goods are shipped.',
    sections: [
      {
        title: 'Technical consultation',
        text: 'The consultation is delivered remotely at the confirmed time. A meeting link is shared using the booking contact details. The service is 30 minutes of technical discussion and high-level next steps; development and detailed specifications are separately quoted.',
      },
      {
        title: 'Project delivery',
        text: 'Project work starts after acceptance, the onboarding payment and receipt of the agreed inputs. Planning estimates for each base package are shown on the services page. The written quotation confirms the actual scope, schedule, dependencies and acceptance criteria. Missing content, credentials or approvals may change the schedule.',
      },
      {
        title: 'Delivery evidence and approval',
        text: 'Deliveries are shared for client review through agreed channels and the private project portal. Client approval is explicit; silence does not automatically approve a milestone. New requirements and additional revision rounds need an accepted change quotation.',
      },
      {
        title: 'Deployment and support',
        text: 'Deployment is to the agreed client-authorised environment. Handover follows the accepted agreement and full payment. The standard 30-calendar-day defect-support window starts from recorded production deployment. Ongoing monitoring, hosting administration and new features require a separate scope.',
      },
    ],
  },
};
@Component({
  standalone: true,
  imports: [RouterLink],
  template: ` <div class="policy-page">
    <header>
      <a class="brand" routerLink="/">Pratyush Mishra</a>
      <nav aria-label="Primary">
        <a routerLink="/work">Services &amp; pricing</a><a routerLink="/contact">Contact</a>
      </nav>
    </header>
    <main>
      <p class="eyebrow">Business information · Updated 26 October 2026</p>
      <h1>{{ policy.title }}</h1>
      <p class="intro">{{ policy.intro }}</p>
      @for (s of policy.sections; track s.title) {
        <section>
          <h2>{{ s.title }}</h2>
          <p>{{ s.text }}</p>
        </section>
      }
      <p class="contact">
        Service provider: Pratyush Mishra ·
        <a href="mailto:developer@pratyushes.dev">developer&#64;pratyushes.dev</a>
      </p>
    </main>
    <footer>
      <a routerLink="/terms">Terms</a><a routerLink="/privacy">Privacy</a
      ><a routerLink="/refunds">Cancellation &amp; refunds</a
      ><a routerLink="/delivery">Service delivery</a><a routerLink="/work">Pricing</a
      ><a routerLink="/about">About</a>
    </footer>
  </div>`,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #07070c;
      color: #c5c8d6;
      font:
        15px/1.85 'Outfit',
        system-ui,
        sans-serif;
    }
    * {
      box-sizing: border-box;
    }
    header,
    main,
    footer {
      max-width: 900px;
      margin: auto;
      padding: 28px 32px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #292933;
    }
    header nav {
      display: flex;
      gap: 22px;
      flex-wrap: wrap;
    }
    .brand {
      font-weight: 700;
      color: #f0f0f6;
      text-decoration: none;
    }
    a {
      color: #d7e9fb;
      text-underline-offset: 4px;
    }
    main {
      padding-top: 55px;
      padding-bottom: 40px;
    }
    .eyebrow {
      font-size: 11px;
      color: #a4a8b7;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1.2;
      letter-spacing: -0.04em;
      color: #f0f0f6;
      margin: 18px 0 25px;
    }
    .intro {
      font-size: 17px;
      color: #b6bbcb;
    }
    section {
      padding: 18px 0;
      border-bottom: 1px solid #292933;
    }
    h2 {
      font-size: 18px;
      color: #f0f0f6;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    p {
      overflow-wrap: anywhere;
    }
    .contact {
      font-size: 13px;
      margin-top: 32px;
    }
    footer {
      display: flex;
      gap: 12px 24px;
      flex-wrap: wrap;
      border-top: 1px solid #292933;
      font-size: 12px;
    }
    a:focus-visible {
      outline: 3px solid #65a4b7;
      outline-offset: 4px;
    }
    @media (max-width: 600px) {
      header,
      main,
      footer {
        padding-left: 20px;
        padding-right: 20px;
      }
      header {
        flex-direction: column;
        gap: 12px;
      }
      main {
        padding-top: 32px;
      }
    }
  `,
})
export class BusinessPolicyComponent {
  private route = inject(ActivatedRoute);
  policy = policies[this.route.snapshot.data['policy']] || policies['terms'];
  constructor() {
    inject(Title).setTitle(this.policy.title + ' | Pratyush Mishra');
  }
}
