import { LEGAL_DETAILS } from './legal-details';
import { escapeHtml, legalPage } from './legal-page';

const contact = escapeHtml(LEGAL_DETAILS.contactEmail);
const operator = escapeHtml(LEGAL_DETAILS.operator);
const governingLaw = escapeHtml(LEGAL_DETAILS.governingLaw);

// A first draft (October 2026). Not legal advice: have it reviewed before external testers or
// the App Store.
const BODY = `
<p>These terms are an agreement between you and ${operator} ("we", "us") about using Progresso. By creating an account or using the app, you agree to them. If you don't agree, please don't use Progresso.</p>

<h2>Who can use Progresso</h2>
<p>You must be at least 13 years old. If you're under the age of majority where you live, you need a parent or guardian's permission.</p>

<h2>Your account</h2>
<p>Give accurate information, keep your password to yourself, and tell us if you think someone else is using your account. You're responsible for what happens under your account.</p>

<h2>Not medical advice</h2>
<p>Progresso helps you record and look back at your training and nutrition. It isn't a doctor, dietitian or coach. Calorie estimates, nutrition data and progress figures are estimates and can be wrong. Talk to a qualified professional before starting a new exercise or diet program, and stop if something hurts. You exercise at your own risk.</p>

<h2>Your content</h2>
<p>Your workouts, meals, photos and profile are yours. You give us permission to store them and show them where you choose: to yourself, to people you accept as followers, to the people in your group workouts and to trainers you link with. That permission ends when you delete them or your account, except for what our Privacy Policy says stays.</p>

<h2>How to treat other people</h2>
<p>Don't harass, threaten or bully anyone, pretend to be someone else, post sexual, violent or illegal content, spam, or try to get into other people's accounts or data. You can block anyone, and report people or workouts from the app. We may remove content and suspend or close accounts that break these rules.</p>

<h2>Trainers and clients</h2>
<p>Trainers and clients arrange their work together between themselves. Progresso provides the tools, and isn't part of that arrangement or responsible for the advice a trainer gives. A trainer only has access to a client's workouts while they're linked, and either of them can end the link at any time.</p>

<h2>Paid features</h2>
<p>Progresso may offer paid subscriptions. If you subscribe, you're billed through the App Store or Google Play under their terms, and you manage or cancel your subscription there. Deleting your Progresso account doesn't cancel a subscription by itself.</p>

<h2>Food and nutrition data</h2>
<p>Some food data comes from other sources, such as USDA FoodData Central and Open Food Facts, or is estimated by AI from your description. It's provided as is and may be incomplete or inaccurate. Check labels when it matters.</p>

<h2>Changes to Progresso</h2>
<p>We're always improving Progresso, so features may change, and some may be removed. We'll try to give notice of big changes.</p>

<h2>Ending your use</h2>
<p>You can stop using Progresso and delete your account at any time in Settings &gt; Account &amp; Security &gt; Delete Account. We may suspend or close your account if you break these terms or misuse Progresso.</p>

<h2>Disclaimers and limits</h2>
<p>Progresso is provided "as is" and "as available", without warranties of any kind, as far as the law allows. As far as the law allows, we're not liable for indirect or consequential losses, or for loss of data, and our total liability to you for any claim is limited to the amount you paid us in the 12 months before it. Nothing in these terms limits rights you have by law that can't be limited.</p>

<h2>The law that applies</h2>
<p>These terms are governed by the laws of ${governingLaw}, except where the law where you live says otherwise.</p>

<h2>Changes to these terms</h2>
<p>If we change these terms, we'll update the date at the top. If a change matters, we'll tell you in the app before it takes effect. Using Progresso after that means you accept the new terms.</p>

<h2>Contact</h2>
<p>Questions about these terms: ${contact}.</p>
`;

export const TERMS_OF_SERVICE_HTML = legalPage('Terms of Service', BODY);
