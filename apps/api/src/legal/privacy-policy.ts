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
  <li><strong>Your profile.</strong> Your name, username, phone number and profile photo, the photos and videos you add to your profile montage, and what you tell us during onboarding: country, gender, birthday, height, weight, fitness goal, training experience and preferences, how you heard about Progresso, your units, and your notification choices.</li>
  <li><strong>Your training.</strong> Workouts, exercises, sets (weights, reps and times), the cardio you add to a workout (the activity and how long it took, and any distance, pace, split or speed, machine speed, incline, level or resistance, floors, steps, stroke rate, laps, pool length or note you enter -- typed in, never read from GPS or Apple Health; cardio no longer asks for calories, and any you entered before stay with the activity, no longer shown), workout splits, the personal records worked out from them, custom exercises with any machine photos you add, and the achievements your activity earns you -- each level reached, when, and the Achievement Points it gave, and where you stand on each -- worked out by our server from what you've logged, with your phone's time zone kept so your weeks and days are your own.</li>
  <li><strong>Your nutrition.</strong> Foods you log, custom foods and their photos, your nutrition goals, and the foods you search for or barcodes you scan. Each food you log keeps the vitamins, minerals and other nutrients its food data gives (from USDA FoodData Central or the product's label), to add up your micronutrients.</li>
  <li><strong>People.</strong> Who you follow and who follows you, the likes and comments you leave on workouts, group workouts you join, trainers or clients you link with, and the people you block or report (and the comment, if you report one). Your notifications -- who asked to follow you or accepted your request, invited you to a workout, or liked or commented on yours, and whether you've read each -- are kept so the Notifications screen can show them, and are deleted with your account.</li>
  <li><strong>Your contacts, only if you allow Progresso to see them.</strong> Each time you open Suggested in Find People, the email addresses and phone numbers in your phone's contacts are scrambled on your phone (a one-way hash) and only those are sent, to find the people on Progresso who have them. Neither your contacts nor what's sent is kept.</li>
  <li><strong>Your device.</strong> A push notification token if you allow notifications, and crash reports that include the app version, what went wrong and your account ID. Crash reports are stripped of other personal details before they're sent.</li>
  <li><strong>Feedback you send.</strong> What you write in Feedback &amp; Suggestions, any screenshot you add to it, and the app version, platform and system version it was sent from.</li>
</ul>
<p>We don't use advertising trackers, we don't run analytics on how you use the app, and we don't sell your data.</p>

<h2>How we use it</h2>
<ul>
  <li>To run Progresso: saving your workouts and meals, working out your records, progress and calorie estimates, and showing them back to you.</li>
  <li>To run the features you choose to use with other people: following, profiles, the Friends feed, likes and comments, finding friends from your contacts, group workouts and trainers.</li>
  <li>To look up foods and nutrition when you search, scan a barcode or describe a meal.</li>
  <li>To send the notifications you've turned on, and one welcome email to your sign-in address when your account is set up.</li>
  <li>To keep Progresso safe: reviewing reports, and keeping blocked people away from you.</li>
  <li>To read the feedback you send, follow it up and improve Progresso with it.</li>
  <li>To fix crashes and keep the service secure.</li>
</ul>

<h2>Who can see your data</h2>
<ul>
  <li><strong>Other people on Progresso.</strong> Your name, username and photo can be found in search and seen on your profile, along with how many people follow you and how many you follow, whether your profile is private, and -- to someone who opens your profile -- which of the people they follow follow you too; anyone with your email address or phone number in their contacts can find you too, unless you turn either off in Settings &gt; Account &amp; Security. Your phone number itself is never shown to anyone. Your profile is private unless you make it public in Settings &gt; Account &amp; Security &gt; Privacy, and you can change it at any time. While it's private, only the people whose follow request you accept see the rest of your profile; while it's public, everyone signed in to Progresso does, and anyone can follow you without a request (making it public accepts the requests waiting; making it private again keeps the followers you have). The rest of your profile is your bio, your achievement rank and Achievement Points (which you can hide in Settings &gt; Account &amp; Security), your montage (the photos and videos you add to it), how many workouts you've finished (all time, the last 30 days and your busiest month), how much you've lifted in all, how many personal records you hold, the achievements you've earned, at what level and when (never a nutrition one -- those only you see), every exercise you've done with your best set on it, your top set on it from each workout and the records you hold on it, who you follow and who follows you, and your workouts in full, their cardio included -- the likes and comments on your workouts (which they can add to; you can delete any comment on your own workout), and your finished workouts in their Friends feed, with each exercise's machine photo, gym and handle if you added them (not your nutrition, and not workouts a trainer logged for you), and the custom exercises you make -- with their photos, gym and grip -- which they can use as they are (your later changes reach them too). People in a group workout with you see that group's workouts. A trainer you link with can see your workouts and log or edit them for you, and every change a trainer makes is recorded; while you're linked, you and your trainer see each other's custom exercises, and using one copies it into your own library. People you block can't find you, follow you or invite you to a group.</li>
  <li><strong>Companies that run parts of Progresso for us</strong>, each only for that purpose:
    <ul>
      <li>Supabase: our database, sign-in and photo and video storage, hosted in Canada.</li>
      <li>Render: the servers that run our API, in the United States.</li>
      <li>Expo: delivering push notifications and app builds.</li>
      <li>Apple and Google: sign-in, if you use them, and delivering notifications to your device.</li>
      <li>Anthropic: when you describe a meal to the AI food search, the text you type, to estimate its nutrition. It isn't sent with your name or account.</li>
      <li>USDA FoodData Central and Open Food Facts: the food you search for or the barcode you scan.</li>
      <li>Resend: sending the welcome email, with your email address and first name.</li>
      <li>Sentry: crash reports.</li>
    </ul>
  </li>
  <li><strong>Feedback you send</strong> is seen only by you and Progresso's admins, who may add notes to it that only they see. You see its status as they move it on.</li>
  <li><strong>When the law requires it</strong>, for example a valid court order.</li>
</ul>

<h2>Health and body information</h2>
<p>Workouts, body measurements and what you eat say a lot about your health. We use them only to provide Progresso to you, never for advertising, and we don't share them beyond what's described above.</p>
<p><strong>Apple Health.</strong> On iPhone, if you connect Apple Health, Progresso reads your step count to show today's steps and your steps over the last few weeks in the app, and today's on its Home Screen widget. It reads nothing else from Apple Health and never writes to it. Your steps are read on your phone each time they're shown and never leave it: they aren't sent to us, stored on our servers, used for advertising or shared with anyone. You can stop it at any time in the Health app.</p>
<p><strong>Your location, while you sign up.</strong> On iPhone, if you allow it, Progresso asks your phone where it is once, while you sign up, so the country you're in can be listed first. Apple's own service on the iPhone names the country, and only that country is used, to sort the list. Your location isn't sent to us or kept, and only the country you pick is saved to your account.</p>
<p><strong>Your location, and your gym.</strong> When you choose the gym you're training at, Progresso asks your phone where it is, while you're using the app, and searches Apple Maps for the gyms near it -- as you open Choose Your Gym if you've already allowed location, otherwise only once you tap Find Gyms Near Me; a gym you search for by name is looked up on Apple Maps too. Your location goes only to Apple's map service for that search (Apple's privacy policy covers it) -- never to us, and it isn't kept. Progresso never asks for your location in the background. Only the gym you choose for a workout is saved, with that workout: its name and address, and where it is on the map. Only you see it -- not your followers, not people in a group workout with you, not a trainer -- and you can change or remove it at any time. It's deleted with the workout's history when you delete your account.</p>
<p><strong>Reminders.</strong> If you allow notifications, the reminders you turn on in Settings &gt; Notifications (your workout days, your meals, a protein and calorie check-in, your weekly summary, and a cheer for a new PR) are scheduled on your phone itself. To write them, the app uses what it already shows you, like your next workout and what you've logged today, and the reminders and your choices stay on your phone: none of it is sent to us. Turn them off in Settings at any time.</p>
<p><strong>Micronutrient recommendations.</strong> To choose which of Health Canada's reference values apply to you, the Micronutrients page uses the birthday and gender in your profile. If you tell it you're pregnant or breastfeeding, or which reference values to use when your gender isn't one Health Canada's tables have, that stays on that phone, kept for your account there: it isn't sent to us or added to your account, and you can change it any time on the Micronutrients page.</p>
<p><strong>Widgets.</strong> If you add a Progresso widget to your Home Screen, or start a workout with Live Activities on, your phone keeps what it shows (today's calories and macros, your next or current workout, your steps) so the widget can show it. It stays on your phone and is cleared when you sign out.</p>

<h2>Keeping and deleting your data</h2>
<p>We keep your data while you have an account. You can delete your account at any time in Settings &gt; Account &amp; Security &gt; Delete Account. That deletes your profile, photos and videos, workouts, records, nutrition logs, custom exercises and foods, follows, the feedback you've sent and its screenshots, and everything else in your account. A few things stay, because they're part of someone else's history:</p>
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
