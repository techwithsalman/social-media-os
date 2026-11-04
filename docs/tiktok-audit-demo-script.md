# TikTok Direct Post API Audit Demo Video Recording Script
**Application Name:** Tech With Salman — Social Media OS  
**Target API:** TikTok Content Posting API / Direct Post API (`/v2/post/publish/video/init/`)  
**Audit Purpose:** Comprehensive UX remediation addressing official TikTok rejection feedback on Point 3 (Commercial Content Disclosure) and Point 4 (Compliance Declarations).  
**Source Standard:** [TikTok Developer Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)

---

## 1. Recording Guidelines & Pre-Flight Checklist

Before recording the demonstration video, verify the following setup:
- **Resolution:** Full HD (1920x1080) at 60 fps or 30 fps.
- **Audio / Commentary:** Clear narration or subtitles explaining each required UX behavior verbatim.
- **Cursor Visibility:** Enable mouse cursor highlighting/click rings so reviewer can see button interactions clearly.
- **Mock / Sandbox Environment:** The demonstration utilizes isolated local test fixtures with simulated TikTok OAuth and Creator Info payloads.
- **No Production Video Uploads:** Do not publish unapproved content to live channels; test simulation accurately replicates all TikTok API responses, payload parameters, and post-publish state transitions.

---

## 2. Screen-by-Screen Walkthrough Script

### Scene 1: Connected Account & Creator Identification (Point 1)
- **Visual:** Navigate to the Social Accounts tab (`/settings` or `/accounts`).
- **Action:** Point cursor to the connected TikTok channel card.
- **What to Show:**
  - Creator Avatar.
  - Creator Nickname (Display Name).
  - Creator `@username` handle.
  - Connected status badge.
- **Audio / Subtitle Script:**
  > *"Welcome to Tech With Salman Social Media OS. We begin by demonstrating Point 1 of TikTok's UX guidelines: clear account identification. The creator's nickname, username handle, and profile avatar are retrieved from TikTok and prominently displayed so the user has full awareness of the connected account."*

---

### Scene 2: Creator Post Composer & Video Media Requirement (Point 4 UX)
- **Visual:** Navigate to **Create Post** (`/create-post`).
- **Action:** Select the connected TikTok channel in Step 1.
- **What to Show:**
  - Dedicated TikTok Creator card renders inside the composer with avatar, nickname, `@handle`, and connection status.
  - Leave media file empty and attempt to publish -> Publish button is blocked with tooltip: *"Media is required for TikTok Direct Post. Please attach a video."*
  - Attach an image file (`.png` / `.jpg`) -> Blocked with tooltip: *"TikTok Direct Post requires a video file (.mp4, .mov, .webm). Image files are not supported."*
  - Attach a valid video file (`sample-video.mp4`) -> Video preview renders cleanly.
- **Audio / Subtitle Script:**
  > *"In the post composer, the creator's identity is reinforced at the top of the platform settings. TikTok Direct Post strictly enforces video media. Text-only posts and still images are rejected with clear instructional feedback. Attaching our video enables media validation."*

---

### Scene 3: Unselected Privacy Default & Interaction Settings (Point 2)
- **Visual:** Scroll down to the TikTok Settings card.
- **Action:** Point cursor to the **Privacy Level** dropdown.
- **What to Show:**
  - Dropdown starts **completely empty** (displaying placeholder: *"Select Privacy Level (Required)"*).
  - Point to the disabled Publish / Schedule buttons showing: *"Please explicitly select a Privacy Level for TikTok before publishing or scheduling."*
  - Point to Interaction Controls:
    - *Allow Comments*: Defaults to unchecked (`false`).
    - *Allow Duet*: Defaults to unchecked (`false`).
    - *Allow Stitch*: Defaults to unchecked (`false`).
    - Show disabled badge if the account has account-level restrictions.
- **Audio / Subtitle Script:**
  > *"Here we demonstrate Point 2. In strict compliance with TikTok requirements, the privacy level dropdown starts empty with no pre-selected default value. The creator must actively select their privacy setting. The interaction controls for Comments, Duet, and Stitch all default to unchecked."*

---

### Scene 4: Commercial Content Disclosure Toggle Defaults to OFF (Point 3.a)
- **Visual:** Focus on the **Commercial Content Disclosure** card.
- **Action:** Point cursor to the master toggle switch.
- **What to Show:**
  - Toggle switch is in the **OFF** position (`false`) by default.
  - Label: *"Commercial Content Disclosure"* with subtitle *"Disclose whether this video promotes yourself, a brand, product, or service."*
  - Point 4 Legal Declaration card underneath reads:
    *"By posting, you agree to TikTok's Terms of Service and confirm that your content complies with TikTok's Community Guidelines."* with clickable official links.
- **Audio / Subtitle Script:**
  > *"Next is Point 3: Commercial Content Disclosure. The toggle switch is strictly turned OFF by default. While disclosure is off, the standard Point 4 policy declaration is shown, linking to TikTok's Terms of Service and Community Guidelines."*

---

### Scene 5: Incomplete Disclosure Validation & Publish Blocking (Point 3.c)
- **Visual:** Click the Commercial Content Disclosure master toggle to **ON**.
- **Action:** Leave both sub-options ("Your brand" and "Branded content") unchecked.
- **What to Show:**
  - Sub-options panel smoothly expands.
  - Alert banner appears: *"You need to indicate if your content promotes yourself, a third party, or both."*
  - Hover over the **Post Now** and **Schedule Post** buttons in the bottom action bar.
  - Both buttons are reactively **disabled and unclickable**, with the exact prompt surfaced.
- **Audio / Subtitle Script:**
  > *"When the creator turns ON Commercial Content Disclosure, the sub-options appear. Notice that if neither option is selected, publishing is immediately disabled, and TikTok's required warning is displayed: 'You need to indicate if your content promotes yourself, a third party, or both.'"*

---

### Scene 6: "Your Brand" (Brand Organic) & Music Usage Confirmation (Point 3.b & Point 4 Case 1)
- **Visual:** Check the checkbox for **"Your brand"** (leave "Branded content" unchecked).
- **Action:** Show the legal declaration update and preview badge.
- **What to Show:**
  - Checkbox highlights with "Promotional content" tag.
  - Helper note: *"You are promoting yourself or your own business. Classified as Brand Organic."*
  - Point 4 Compliance card updates immediately to:
    *"By posting, you agree to TikTok's [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
  - Click the hyperlink: opens `https://www.tiktok.com/legal/page/global/music-usage-confirmation/en` in a new browser tab.
  - Point to the Live Preview panel on the right: the *"Promotional content"* badge is displayed on the post.
- **Audio / Subtitle Script:**
  > *"When 'Your brand' is selected, the content is classified as Brand Organic. Notice that Point 4 compliance dynamically updates to present TikTok's Music Usage Confirmation agreement with a clickable link to official documentation. The live preview updates to display the Promotional Content tag."*

---

### Scene 7: "Branded Content" (Paid Partnership) & Privacy Restriction (Point 3.b, Point 3.e, & Point 4 Case 2)
- **Visual:** Uncheck "Your brand" and check **"Branded content"**.
- **Action:** Demonstrate the policy declaration update AND open the Privacy dropdown.
- **What to Show:**
  - Checkbox highlights with "Paid partnership" tag.
  - Helper note: *"You are promoting another brand or third party in exchange for something of value."*
  - Point 4 Compliance card updates immediately to:
    *"By posting, you agree to TikTok's [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) and [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
  - Click both hyperlinks: opens both official policy pages in new tabs.
  - **Privacy Restriction Enforcement:**
    - Click the Privacy dropdown.
    - Show that option **"Only Me (Private)" is disabled, greyed out, and unclickable**.
    - Informational alert reads: *"Branded content visibility cannot be set to private. Post visibility is restricted to Public or Friends."*
  - Point to Live Preview: the *"Paid partnership"* badge is displayed.
- **Audio / Subtitle Script:**
  > *"Now we select 'Branded content' for paid sponsorships. Point 4 compliance dynamically requires agreement to both the Branded Content Policy and Music Usage Confirmation. Furthermore, in strict adherence to TikTok policy, Branded Content visibility cannot be private. The 'Only Me' option in the privacy dropdown is disabled and unclickable."*

---

### Scene 8: Dual Commercial Content Selection (Point 3.b & Point 4 Case 3)
- **Visual:** Check BOTH **"Your brand"** AND **"Branded content"**.
- **What to Show:**
  - Both checkboxes are checked simultaneously.
  - Compliance card confirms both Branded Content Policy and Music Usage Confirmation are active.
  - Private visibility remains locked/disabled.
- **Audio / Subtitle Script:**
  > *"The interface also supports selecting both options when content simultaneously promotes the creator's brand and an external sponsor, maintaining full compliance restrictions."*

---

### Scene 9: Explicit User Review & Publish Confirmation Modal (Point 6 & Point 10)
- **Visual:** In Privacy dropdown, select **"Public to Everyone"**.
- **Action:** Click **"Post Now (1)"** button.
- **What to Show:**
  - Clicking "Post Now" does not post silently in background.
  - **Publish Confirmation Modal** opens over the screen.
  - Modal displays:
    - Target Channel: TikTok (`@creator_handle`).
    - Post Mode: Direct Post to Profile.
    - Privacy Level: Public to Everyone.
    - Commercial Content: Branded Content (Paid Partnership).
    - Point 4 Compliance Declaration rendered directly above the "Publish Now" button.
- **Audio / Subtitle Script:**
  > *"We select 'Public to Everyone' and click Post Now. No background posting occurs without affirmative user action. The confirmation modal gives the creator a final review of the account, privacy level, commercial classification, and legal acknowledgements before submission."*

---

### Scene 10: Publishing Execution & Status Notice (Point 7)
- **Visual:** Click **"Publish Now"** in the confirmation modal.
- **What to Show:**
  - Modal closes, spinner displays while publish request is dispatched.
  - Green success banner appears with platform result card.
  - Success banner explicitly shows:
    - Status: `PUBLISHED` (or processing state).
    - Informational callout: *"TikTok is processing and transcoding your video. Video moderation and processing typically take 2 to 5 minutes before the post becomes visible on your profile."*
- **Audio / Subtitle Script:**
  > *"Upon clicking Publish Now, the video initialization payload is transmitted with the exact privacy and disclosure flags. The confirmation banner clearly informs the creator that TikTok takes 2 to 5 minutes to transcode, moderate, and publish the video to their public profile."*

---

### Scene 11: Creator Inbox (Draft Mode) Distinction (Point 8)
- **Visual:** Reset the composer to blank and switch the TikTok Post Mode segmented control from "Direct Post" to **"Creator Inbox (Upload as Draft)"**.
- **What to Show:**
  - Explanation subtitle: *"Uploads the video to your TikTok Creator Inbox as a draft. Open the TikTok mobile app to add sounds, text, filters, and complete final publishing."*
  - Commercial Content Disclosure and privacy controls are hidden (as these are configured natively inside the TikTok mobile app for inbox drafts).
- **Audio / Subtitle Script:**
  > *"Finally, we demonstrate the distinction between Direct Post and Creator Inbox. Creator Inbox mode sends the video directly to the creator's mobile app inbox as a draft, allowing final in-app creative edits."*

---

## 3. Summary of Covered Audit Points in Demo Video

| Audit Point | Covered in Scene | Verified in Code & Tests |
| :--- | :--- | :--- |
| **Point 1 (Creator Awareness)** | Scene 1, Scene 2 | `tests/tiktok-account-identity.test.ts` |
| **Point 2 (Privacy & Interactions)** | Scene 3 | `tests/tiktok-point4-compliance.test.ts` (Scenario 9 & 10) |
| **Point 3.a (Disclosure Toggle OFF by default)** | Scene 4 | `tests/tiktok-point3-commercial-content.test.ts` |
| **Point 3.b (Your Brand vs Branded Content sub-options)** | Scene 6, Scene 7, Scene 8 | `tests/tiktok-point3-commercial-content.test.ts` (Scenarios 3, 6, 7) |
| **Point 3.c (Disabled publish on incomplete disclosure)** | Scene 5 | `tests/tiktok-point3-commercial-content.test.ts` (Scenario 2) |
| **Point 3.e (Branded Content cannot be private)** | Scene 7 | `tests/tiktok-point3-commercial-content.test.ts` (Scenarios 5, 8) |
| **Point 4 (Legal Declarations & Links)** | Scene 4, Scene 6, Scene 7, Scene 8, Scene 9 | `tests/tiktok-point4-compliance.test.ts` (Scenarios 1, 2, 3, 4) |
| **Point 5 / 6 (Explicit User Confirmation)** | Scene 9 | `tests/tiktok-point4-compliance.test.ts` |
| **Point 7 (2-5 Min Processing Notice)** | Scene 10 | `tests/tiktok-point4-compliance.test.ts` |
| **Point 8 (Direct Post vs Inbox Draft)** | Scene 11 | `tests/tiktok-point4-compliance.test.ts` (Scenario 8) |
| **Point 9 / 10 (Payload Fields & No Auto-Publish)** | Scene 9, Scene 10 | `tests/tiktok-point3-commercial-content.test.ts` |
