import { LEGAL_DETAILS } from './legal-details';
import { escapeHtml, legalPage } from './legal-page';

const contact = escapeHtml(LEGAL_DETAILS.contactEmail);
const operator = escapeHtml(LEGAL_DETAILS.operator);

// A first draft, written from what the app and API actually collect and send (October 2026).
// Not legal advice: have it reviewed before external testers or the App Store. When a feature
// changes what's collected or who it's shared with, change this text in the same change.
const BODY = `
<p>Progresso is a workout and nutrition tracker. This policy explains what we collect when you use it, why, who can see it, and how to delete it. Progresso is operated by ${operator} ("we", "us").</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Your account.</strong> Your email address and password, or the name and email Apple or Google share with us if you sign in with them. Passwords are handled by our sign-in provider and are never stored in plain text.</li>
  <li><strong>Your profile.</strong> Your name, username and profile photo, and what you tell us during onboarding: country, gender, birthday, height, weight, fitness goal, training experience and preferences, how you heard about Progresso, your units, and your notification choices.</li>
  <li><strong>Your training.</strong> Workouts, exercises, sets (weights, reps and times), workout splits, the personal records worked out from them, and custom exercises with any machine photos you add.</li>
  <li><strong>Your nutrition.</strong> Foods you log, custom foods and their photos, your nutrition goals, and the foods you search for or barcodes you scan.</li>
  <li><strong>People.</strong> Who you follow and who follows you, group workouts you join, trainers or clients you link with, and the people you block or report.</li>
  <li><strong>Your device.</strong> A push notification token if you allow notifications, and crash reports that include the app version, what went wrong and your account ID. Crash reports are stripped of other personal details before they're sent.</li>
</ul>
<p>We don't use advertising trackers, we don't run analytics on how you use the app, and we don't sell your data.</p>

<h2>How we use it</h2>
<ul>
  <li>To run Progresso: saving your workouts and meals, working out your records, progress and calorie estimates, and showing them back to you.</li>
  <li>To run the features you choose to use with other people: following, the Friends feed, group workouts and trainers.</li>
  <li>To look up foods and nutrition when you search, scan a barcode or describe a meal.</li>
  <li>To send the notifications you've turned on.</li>
  <li>To keep Progresso safe: reviewing reports, and keeping blocked people away from you.</li>
  <li>To fix crashes and keep the service secure.</li>
</ul>

<h2>Who can see your data</h2>
<ul>
  <li><strong>Other people on Progresso.</strong> Your name, username and photo can be found in search. People whose follow request you accept see your finished workouts in their Friends feed (not your nutrition, and not workouts a trainer logged for you). People in a group workout with you see that group's workouts. A trainer you link with can see your workouts and log or edit them for you, and every change a trainer makes is recorded. People you block can't find you, follow you or invite you to a group.</li>
  <li><strong>Companies that run parts of Progresso for us</strong>, each only for that purpose:
    <ul>
      <li>Supabase: our database, sign-in and photo storage, hosted in Canada.</li>
      <li>Render: the servers that run our API, in the United States.</li>
      <li>Expo: delivering push notifications and app builds.</li>
      <li>Apple and Google: sign-in, if you use them, and delivering notifications to your device.</li>
      <li>Anthropic: when you describe a meal to the AI food search, the text you type, to estimate its nutrition. It isn't sent with your name or account.</li>
      <li>USDA FoodData Central and Open Food Facts: the food you search for or the barcode you scan.</li>
      <li>Sentry: crash reports.</li>
    </ul>
  </li>
  <li><strong>When the law requires it</strong>, for example a valid court order.</li>
</ul>

<h2>Health and body information</h2>
<p>Workouts, body measurements and what you eat say a lot about your health. We use them only to provide Progresso to you, never for advertising, and we don't share them beyond what's described above. Progresso doesn't connect to Apple Health.</p>

<h2>Keeping and deleting your data</h2>
<p>We keep your data while you have an account. You can delete your account at any time in Settings &gt; Account &amp; Security &gt; Delete Account. That deletes your profile, photos, workouts, records, nutrition logs, custom exercises and foods, follows and everything else in your account. A few things stay, because they're part of someone else's history:</p>
<ul>
  <li>If a friend used one of your custom exercises in a group workout, they keep their own copy of it, without your photos.</li>
  <li>Reports you made about other people are kept for review, without your name on them.</li>
  <li>If you're a trainer, clients you track without an account can claim their history for 30 days, then it's deleted.</li>
</ul>
<p>Encrypted backups of our database are kept for up to 30 days, so deleted data can remain in a backup for that long before it's gone for good.</p>

<h2>Your choices</h2>
<ul>
  <li>Change your profile, units and notifications in Settings at any time.</li>
  <li>Block people, or end a trainer link, whenever you want.</li>
  <li>Ask us for a copy of your data, or ask us anything about it, at ${contact}.</li>
</ul>
<p>Depending on where you live, you may have more rights over your data, such as correcting it or objecting to how it's used. Contact us and we'll help.</p>

<h2>Children</h2>
<p>Progresso isn't meant for anyone under 13, and we don't knowingly collect data from them. If you think a child has made an account, contact us and we'll delete it.</p>

<h2>Security</h2>
<p>Your data is encrypted in transit, and each account can only reach its own data unless you share it as described above. No system is perfectly secure, but we work to protect what you trust us with.</p>

<h2>Where your data is kept</h2>
<p>Your data is stored in Canada and processed on servers in the United States. By using Progresso, you understand it may be handled outside your own country.</p>

<h2>Changes to this policy</h2>
<p>If we change this policy, we'll update the date at the top. If a change matters, we'll tell you in the app before it takes effect.</p>

<h2>Contact</h2>
<p>Questions about privacy or your data: ${contact}.</p>
`;

export const PRIVACY_POLICY_HTML = legalPage('Privacy Policy', BODY);
