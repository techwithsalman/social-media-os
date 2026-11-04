# TikTok Direct Post API Audit Reapplication & Conformance Report
**Document Version:** 1.0.0  
**Project:** Tech With Salman Social Media OS  
**Target Audit:** TikTok Content Posting API (Direct Post & Creator Inbox)  
**Reference Document:** [TikTok Developer Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)  
**Date:** November 2026  

---

## 1. Executive Summary & Audit Context

### 1.1 Previous Rejection Feedback
TikTok App Review rejected the previous audit submission with the following explicit feedback:

> *"Please review the 'Required UX Implementation in Your App' section of the Content Sharing Guidelines for the complete requirements. All applicable requirements must be clearly demonstrated in the Demo Video."*  
> *"Your application does not follow Point 3 of our UX Guidelines, please demonstrate every required Point 3 behavior in the Demo Video."*  
> *"Your application does not follow Point 4 of our UX Guidelines, please demonstrate every required Point 4 behavior in the Demo Video."*

### 1.2 Core Audit Finding
Our deep codebase audit confirms that while the application implements OAuth 2.0 PKCE, creator information querying, chunked binary media upload, and post status reconciliation:
1. **Point 3 (Content Disclosure Setting)** is completely absent from the UI and API payload. The application has no Commercial Content toggle, no "Your brand" or "Branded content" selections, does not restrict private visibility (`SELF_ONLY`) for branded content, and does not disable publishing when disclosure is incomplete.
2. **Point 4 (Compliance Requirements & Declarations)** is completely absent. The required dynamic legal declarations ("Music Usage Confirmation" and "Branded Content Policy and Music Usage Confirmation") with official hyperlinks are never displayed to the user prior to posting.
3. **Demo Video Gaps (Points 1 & 2)**: Several capabilities (such as creator nickname display, unselected privacy dropdown, and interaction restrictions) exist in code but were poorly emphasized or not explicitly demonstrated in the submitted screen recording.

---

## 2. Official TikTok Guidelines: Verbatim Requirements

According to TikTok's official developer documentation under **"Required UX Implementation in Your App"**, third-party applications integrating Direct Post must adhere to the following strict specifications:

### Point 1: Creator Information & Account Awareness
- **1.a Display Connected Creator Info:** When rendering the post creation or sharing view, the application **must** retrieve and prominently display the connected creator's **nickname** and **avatar** so that users have clear visibility into which TikTok account will receive the upload.
- **1.b Check Creator Status & Limits:** The application must invoke the Creator Info API (`POST /v2/post/publish/creator_info/query/`). If the creator cannot make posts at that moment (e.g., account limits exceeded), the application **must** halt the publishing flow and prompt the user to try again later.
- **1.c Check Video Duration Limits:** The video file duration must not exceed the creator account's permitted `max_video_post_duration_sec`.

### Point 2: Post Metadata & Interaction Controls
- **2.a Metadata Inputs:** Provide user-editable inputs for post title/caption and hashtags.
- **2.b Privacy Level Selection (No Default Allowed):**
  - The UI must dynamically populate privacy options matching `privacy_level_options` returned by the Creator Info API (`PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `FOLLOWER_OF_CREATOR`, `SELF_ONLY`).
  - **The privacy dropdown must start empty/unselected (no pre-selected default value)**. The creator must manually choose an option before publishing is allowed.
- **2.c Interaction Settings (Comments, Duet, Stitch):**
  - Must provide toggles/checkboxes for:
    - *Allow Comments*
    - *Allow Duet*
    - *Allow Stitch*
  - **Default State**: Must **not** be checked by default.
  - **Account Restriction Enforcement**: If the creator's TikTok account settings have any of these interactions disabled (`comment_disabled`, `duet_disabled`, or `stitch_disabled`), the corresponding control in the UI **must be disabled, greyed out, and unclickable**, with an explanatory label (e.g., *"Disabled by creator account in TikTok"*).
  - Duet and Stitch must only apply to video content (disabled or hidden for photos).

### Point 3: Content Disclosure Setting (Primary Rejection Reason)
- **3.a Commercial Content Disclosure Switch:**
  - The UI must feature an explicit switch or toggle labeled: **"Commercial Content Disclosure"** (or *"Disclose commercial content"* / *"Disclose post content"*).
  - **Default State**: Must be **turned OFF / unchecked by default**.
- **3.b Sub-Options (Multi-Selection Allowed):**
  - When the disclosure toggle is switched **ON**, the UI must reveal two distinct checkboxes:
    1. **"Your brand"**: Selected when the user is promoting themselves or their own business (classified as Brand Organic; triggers TikTok's *"Promotional content"* label). Maps to API payload parameter `brand_organic_toggle: true`.
    2. **"Branded content"**: Selected when the user is promoting a third-party brand or product in exchange for payment, free items, or another incentive (classified as Branded Content; triggers TikTok's *"Paid partnership"* label). Maps to API payload parameter `brand_content_toggle: true`.
  - The user may select **Your brand**, **Branded content**, or **Both**.
- **3.c Publish Button Validation (Incomplete Disclosure):**
  - If the commercial content toggle is switched **ON**, but **neither** "Your brand" nor "Branded content" is selected:
    - The Publish / Schedule button **must be disabled**.
    - The UI must display an inline helper prompt / tooltip:  
      > *"You need to indicate if your content promotes yourself, a third party, or both."*
- **3.d Privacy Restriction for Branded Content:**
  - If the user checks **"Branded content"** (`brand_content_toggle: true`):
    - Video visibility **cannot be set to "Only Me" (Private / `SELF_ONLY`)**. TikTok policy mandates that commercial branded partnerships must be viewable by the public or friends.
    - The `SELF_ONLY` option in the Privacy dropdown **must be disabled / greyed out**.
    - If the user had previously selected `SELF_ONLY` before checking "Branded content", the selection must be automatically cleared, and an inline warning/tooltip must state:  
      > *"Branded content visibility cannot be set to private."*

### Point 4: Compliance Requirements & Declarations (Primary Rejection Reason)
When the user switches ON the Commercial Content Disclosure toggle, the application **must** display an explicit legal consent declaration directly above the Publish / Schedule action:
- **Case 1: When only "Your brand" is checked:**
  > *"By posting, you agree to TikTok's [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
- **Case 2: When "Branded content" is checked (or both are checked):**
  > *"By posting, you agree to TikTok's [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) and [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
- **Case 3: Interactive Hyperlinks:**
  - Both *"Branded Content Policy"* and *"Music Usage Confirmation"* must be clickable hyperlinks that open TikTok's official legal terms in a new tab.

### Point 5: Content Integrity, Preview & User Consent
- **5.a Media Preview**: The UI must display a clear video preview and duration.
- **5.b No Forced Third-Party Watermarks**: Third-party branding, logos, or app names must never be overlaid on user video files.
- **5.c Editable Metadata**: Presets (captions, tags) must remain fully editable by the user.
- **5.d Explicit Upload Consent**: Media file transfer to TikTok must only initiate when the user intentionally clicks the primary action button.
- **5.e Post-Publishing Feedback**: Inform the creator immediately upon submission that it may take a few minutes for TikTok to finish backend transcoding and content moderation before the video appears on their public profile.

---

## 3. Current Implementation vs. Required UX: Gap Analysis Matrix

| Requirement | TikTok Specification | Existing Codebase State | Audit Status | Required Action |
| :--- | :--- | :--- | :--- | :--- |
| **P1: Creator Nickname & Avatar** | Display creator nickname and avatar on the composer view. | Fetched via `/api/tiktok/creator-info` and displayed in the global account pill selector at top, but missing a dedicated account profile badge inside the TikTok Settings card. | ⚠️ Partially Shown | Add a dedicated Creator Profile Card (avatar, nickname, `@username`, connection badge) directly inside the TikTok Settings panel. |
| **P1: Posting Limits** | Block publishing if creator limit reached. | Handled via API exception catch, but lacks dedicated proactive check on `creator_info`. | ⚠️ Reactive only | Verify `creator_info` return status before enabling submission. |
| **P2: Privacy Level (No Default)** | Dynamic dropdown matching creator capabilities; **must start unselected**. | Dropdown starts empty with `-- Select Privacy Level (Required) --`. | ✅ Compliant in Code | Must clearly record this unselected state in the demo video. |
| **P2: Interaction Controls** | Checkboxes for Comments, Duet, Stitch; default unchecked; disabled if account forbids. | Implemented: toggles disable if account returns `commentDisabled`, `duetDisabled`, or `stitchDisabled`. | ✅ Compliant in Code | Must demonstrate account restriction state during video. |
| **P3: Commercial Disclosure Toggle** | Switch for commercial content; **default OFF**. | Completely absent from frontend and backend. | ❌ Non-Compliant | Add master toggle with default `false`. |
| **P3: "Your Brand" Option** | Checkbox for organic self-promotion; sets `brand_organic_toggle: true`. | Absent from UI and API request body. | ❌ Non-Compliant | Add checkbox; map to `metadata.brandOrganicToggle` and API payload. |
| **P3: "Branded Content" Option** | Checkbox for 3rd party paid partnership; sets `brand_content_toggle: true`. | Absent from UI and API request body. | ❌ Non-Compliant | Add checkbox; map to `metadata.brandContentToggle` and API payload. |
| **P3: Disclosure Button Validation** | Disable Publish button if disclosure is ON but no sub-option selected; show prompt. | Publish button only validates on submit, never reactively disabled for disclosure. | ❌ Non-Compliant | Disable button reactively; display prompt: *"You need to indicate if your content promotes yourself, a third party, or both."* |
| **P3: Branded Content Privacy Restriction** | Disable "Only Me" (`SELF_ONLY`) if Branded Content is selected; show warning. | No restriction exists; user can pick `SELF_ONLY` for any post. | ❌ Non-Compliant | Disable `SELF_ONLY` option when `brandContentToggle === true`; auto-clear selection and show banner: *"Branded content visibility cannot be set to private."* |
| **P4: Music Usage Confirmation** | Display declaration linking to Music Usage Confirmation when "Your Brand" is checked. | Completely absent. | ❌ Non-Compliant | Render declaration with link to official policy. |
| **P4: Branded Content Policy Declaration** | Display declaration linking to Branded Content Policy + Music Usage Confirmation when "Branded Content" is checked. | Completely absent. | ❌ Non-Compliant | Render combined declaration with links to both official policies. |
| **P5: Video Requirement** | TikTok Direct Post strictly requires video media. | Frontend only checks `mediaFile` for YouTube (`validateYouTubeMedia`). TikTok allows submitting text-only posts which fail at API level. | ❌ Non-Compliant | Enforce `validateTikTokMedia()`: require valid video file before publishing to TikTok. |
| **P5: Processing Notice** | Inform user of transcoding/processing delay. | Returned status message displays "Publicly published", but composer notification lacks the required 2–5 minute processing disclosure. | ⚠️ Partially Shown | Display banner after publishing: *"Video submitted to TikTok! It may take 2–5 minutes to process and appear on your profile."* |

---

## 4. Codebase Architecture Audit

### 4.1 Frontend Composer (`app/(dashboard)/create-post/page.tsx`)
- **Default State**:
  `DEFAULT_PLATFORM_SETTINGS.TIKTOK` currently holds:
  ```typescript
  TIKTOK: {
    caption: '',
    hashtags: '#fyp #trending #viral',
    contentType: 'VIDEO',
    visibility: '',
    allowComments: false,
    hideLikes: false,
    allowDuet: false,
    allowStitch: false,
    linkUrl: '',
    youtubeTitle: '',
    categoryId: '22',
    audience: 'PUBLIC',
  }
  ```
  *Missing*: `commercialContentDisclosure: false`, `brandOrganicToggle: false`, `brandContentToggle: false`.
- **Validation**:
  `validateTikTokRequirements()` only checks `tiktokCreatorInfoLoading`, `tiktokCreatorInfoError`, and `!tikTokSettings.visibility`.
  *Missing*: Media attachment check, commercial disclosure validation, and branded content private privacy restriction.
- **Publish & Schedule Buttons**:
  Buttons (`handlePublishNow` and `handleReviewSchedule`) only disable during active `publishing` or `selectedAccounts.length === 0`. They do not reactively disable when TikTok form constraints fail.

### 4.2 Bulk Uploader (`app/(dashboard)/bulk-upload/page.tsx`)
- Similar to composer, TikTok items are validated for privacy selection, but commercial disclosure parameters are not exposed or validated.

### 4.3 Integration Adapter (`integrations/tiktok/index.ts`)
- In `publishPost(payload: PublishPayload)`:
  The `requestBody` sent to `POST https://open.tiktokapis.com/v2/post/publish/video/init/`:
  ```typescript
  post_info: {
    title: `${payload.caption} ${payload.hashtags || ''}`.trim(),
    privacy_level: payload.visibility,
    disable_comment: disableComment,
    disable_duet: disableDuet,
    disable_stitch: disableStitch,
  }
  ```
  *Missing*:
  ```typescript
  brand_organic_toggle: payload.metadata?.brandOrganicToggle ?? false,
  brand_content_toggle: payload.metadata?.brandContentToggle ?? false,
  ```
- Lacks defensive server-side rejection if `brand_content_toggle: true` is combined with `privacy_level: 'SELF_ONLY'`.

### 4.4 API Routes (`app/api/posts/route.ts` & `app/api/posts/bulk/route.ts`)
- Backend validates `setting.platform === 'TIKTOK'` for `validTikTokPrivacy`, but lacks:
  1. `mediaAssetId` presence assertion (video required).
  2. Commercial disclosure assertion: if `commercialContentDisclosure` is true, require at least one of `brandOrganicToggle` or `brandContentToggle`.
  3. Branded content privacy restriction: if `brandContentToggle === true`, reject `SELF_ONLY`.
  4. Saving `brandOrganicToggle` and `brandContentToggle` into `platformPosts.metadata`.

### 4.5 Queue Publishing Engine (`lib/queue/publisher.ts`)
- `PublishingEngine.publishContentPost()` extracts `metadataObj` from `pPost.metadata` and forwards it into `adapter.publishPost({ metadata: metadataObj })`.
- Once `metadata` contains `brandOrganicToggle` and `brandContentToggle`, the queue publisher will pass them through to `TikTokAdapter`.

### 4.6 Prisma Database Models (`prisma/schema.prisma`)
- `ContentPost` has `mediaAssetId`, `status`, `scheduledFor`.
- `PlatformPost` has `metadata String?` (stores JSON strings).
- **No database schema migration is required** because platform-specific disclosure flags (`brandOrganicToggle`, `brandContentToggle`, `commercialContentDisclosure`) serialize directly into the existing `metadata` JSON column of `PlatformPost`.

---

## 5. File-by-File Implementation Checklist

### File 1: `integrations/types.ts`
- [ ] Extend `PublishPayload` metadata definition or comments to document `brandOrganicToggle` and `brandContentToggle`.

### File 2: `integrations/tiktok/index.ts`
- [ ] In `publishPost()`:
  - Extract `brandOrganicToggle` and `brandContentToggle` from `payload.metadata`.
  - Add API level validation: if `brandContentToggle === true` and `payload.visibility === 'SELF_ONLY'`, return `TIKTOK_INVALID_BRANDED_PRIVACY` failure.
  - Add `brand_organic_toggle` and `brand_content_toggle` into `post_info` for the `/v2/post/publish/video/init/` request payload.
  - In mock simulation block (lines 169–178), reflect commercial disclosure status in mock response logging.

### File 3: `app/(dashboard)/create-post/page.tsx`
- [ ] **State Expansion**:
  - Add `commercialContentDisclosure: false`, `brandOrganicToggle: false`, `brandContentToggle: false` to `DEFAULT_PLATFORM_SETTINGS.TIKTOK`.
- [ ] **TikTok Settings UI**:
  - Add **Creator Identity Header**: Show avatar, nickname, `@handle`, and "Active Direct Post Account" pill.
  - Add **Media File Validation**: Check if video file is selected when TikTok is checked.
  - Add **Privacy Dropdown Enforcement**:
    - When `brandContentToggle` is true, disable the `SELF_ONLY` (`Only Me (Private)`) option in the dropdown.
    - If `visibility === 'SELF_ONLY'` and user checks `brandContentToggle`, automatically reset `visibility` to `''` and display warning alert.
  - Add **Commercial Content Disclosure Section**:
    - Switch/toggle for *"Commercial Content Disclosure"* (default: OFF).
    - Sub-options container (visible only when switch is ON):
      - Checkbox: *"Your brand (Promote yourself or your own business)"*
      - Checkbox: *"Branded content (Paid partnership with another brand)"*
  - Add **Policy Consent Footer (Point 4)**:
    - If only *Your brand* is checked: display *"By posting, you agree to TikTok's [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
    - If *Branded content* is checked (or both): display *"By posting, you agree to TikTok's [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) and [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
- [ ] **Publish Button Reactive Disabling**:
  - Disable Publish / Schedule buttons if TikTok is selected and:
    - No video is attached, OR
    - Privacy level is not selected, OR
    - Commercial disclosure is ON, but neither *Your brand* nor *Branded content* is selected.
  - Show contextual helper text directly above the disabled button: *"You need to indicate if your content promotes yourself, a third party, or both before publishing to TikTok."*
- [ ] **Post-Submission Notice**:
  - Display feedback banner noting that video processing on TikTok takes 2–5 minutes.

### File 4: `app/api/posts/route.ts` & `app/api/posts/bulk/route.ts`
- [ ] Add backend validation for TikTok targets:
  - Require video `mediaAssetId`.
  - If `commercialContentDisclosure === true`, require at least one brand toggle.
  - If `brandContentToggle === true`, prohibit `visibility === 'SELF_ONLY'`.
  - Save `commercialContentDisclosure`, `brandOrganicToggle`, and `brandContentToggle` into `p.metadata`.

### File 5: `app/(dashboard)/bulk-upload/page.tsx`
- [ ] Update TikTok bulk item validation to align with disclosure rules.

---

## 6. Safe Local Preview & Mock Testing Strategy

To preview and test the complete UI flow without real TikTok developer credentials or risk to production data:

### 6.1 Configuration
Ensure your local `.env.local` contains:
```env
MOCK_API_MODE=true
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6.2 Pre-seeded Mock Creator Account
The application contains a built-in mock creator account configured in `lib/platforms.ts`:
- **Name**: `Alex Rivera Studio`
- **Username**: `@alexrivera_official`
- **Avatar**: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80`
- **Privacy Options**: `['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']`
- **Interactions**: All supported (`commentDisabled: false`, `duetDisabled: false`, `stitchDisabled: false`)

### 6.3 Verification Walkthrough (Step-by-Step)
1. **Launch Local Server**:
   ```powershell
   npm.cmd run dev
   ```
2. **Access Composer**: Navigate to `http://localhost:3000/create-post`.
3. **Select Mock TikTok Account**: The dedicated TikTok Creator Card renders showing Alex Rivera Studio (`@alexrivera_official`).
4. **Test Point 2 (Privacy Dropdown)**:
   - Notice the Privacy dropdown starts empty (`-- Select Privacy Level (Required) --`).
   - Notice Publish button is disabled until privacy is chosen.
5. **Test Point 3 (Commercial Content Disclosure)**:
   - Toggle **ON** "Commercial Content Disclosure".
   - Notice that before checking any sub-option, the Publish button **disables** and displays:  
     > *"You need to indicate if your content promotes yourself, a third party, or both."*
   - Check **"Your brand"**:
     - Notice the Publish button becomes re-enabled (if privacy is selected).
     - Notice Point 4 declaration appears:  
       > *"By posting, you agree to TikTok's Music Usage Confirmation."*
   - Check **"Branded content"**:
     - Notice the declaration updates to:  
       > *"By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."*
     - Open the Privacy dropdown: notice **"Only Me (Private)" is disabled and unclickable**.
     - An alert states: *"Branded content visibility cannot be set to private."*
6. **Submit Post**:
   - Click **Publish Now**.
   - Because `MOCK_API_MODE=true`, `TikTokAdapter.publishPost` simulates immediate success (`tt_v_...`) without calling external TikTok APIs.
   - The user is notified: *"Video submitted to TikTok! It may take 2–5 minutes to process and appear on your profile."*

---

## 7. Demo Video Recording Script (TikTok Reviewer Alignment)

When submitting for audit reapplication, the video recording **must strictly demonstrate** every required behavior:

| Scene | Action on Screen | Audio / Text Overlay Callout | Focus Point |
| :---: | :--- | :--- | :---: |
| **1** | Open `/create-post` and select the connected TikTok Creator account. | "Demonstrating Creator Identity disclosure: Account nickname and avatar displayed." | **Point 1** |
| **2** | Attach a video file. Show Privacy Level dropdown starting unselected (`-- Select Privacy Level --`). | "Demonstrating Privacy Selection: No pre-selected default value. Creator must actively select." | **Point 2** |
| **3** | Hover over Interaction settings (Comments, Duet, Stitch) showing they default to unchecked. | "Demonstrating Interaction Settings: Respects creator account capabilities." | **Point 2** |
| **4** | Toggle ON the **"Commercial Content Disclosure"** switch. | "Demonstrating Point 3: Commercial Content Disclosure switch (defaults to OFF)." | **Point 3** |
| **5** | Leave both sub-options unchecked. Hover/point to the disabled Publish button and helper prompt. | "Demonstrating Point 3: Publish button disabled with prompt: 'You need to indicate if your content promotes yourself, a third party, or both.'" | **Point 3** |
| **6** | Check **"Your brand"**. Show the Music Usage Confirmation policy declaration with working link. | "Demonstrating Point 4: Music Usage Confirmation agreement displayed." | **Point 4** |
| **7** | Check **"Branded content"**. Show the updated declaration for Branded Content Policy + Music Usage Confirmation with working links. | "Demonstrating Point 4: Branded Content Policy & Music Usage Confirmation agreements displayed." | **Point 4** |
| **8** | Click the Privacy dropdown. Show that **"Only Me (Private)" is disabled / greyed out** with tooltip: *"Branded content visibility cannot be set to private."* | "Demonstrating Point 3: Branded content cannot be set to private." | **Point 3** |
| **9** | Select **"Public to Everyone"**. Publish button becomes active. Click **Publish Now**. | "Demonstrating affirmative user consent to publish." | **Point 5** |
| **10** | Show success screen with message noting the 2–5 minute transcoding/processing duration. | "Demonstrating post-publishing status and processing transparency." | **Point 5** |

---

## 8. Summary of Completed Actions

1. ✅ **Official Guidelines Verified**: Sourced exact text and constraints for Points 1, 2, 3, 4, and 5 from `developers.tiktok.com/docs/en/content-sharing-guidelines`.
2. ✅ **Dependencies Installed**: Successfully installed 475 npm packages and generated Prisma Client (`v5.22.0`).
3. ✅ **Full Codebase Audit Completed**: Inspected frontend composer, bulk uploader, integration adapter, API routes, database schema, and queue publisher.
4. ✅ **File-by-File Checklist Prepared**: Defined exact changes required across 5 files.
5. ✅ **Mock Testing Strategy Established**: Documented zero-credential local test plan using pre-configured mock creator data.
6. ✅ **Audit Document Saved**: Persisted in `docs/tiktok-direct-post-audit.md`.

*Next Phase*: Execute Point 4 legal policy declarations and demo video capture.

---

## 9. Implementation Log: Point 3 (Commercial Content Disclosure & Privacy Enforcement)

**Status:** ✅ **Fully Implemented & Verified (All 10 Test Scenarios Passed)**

### 9.1 Implemented Features
1. **Commercial Content Disclosure Toggle**:
   - Implemented master toggle in `create-post/page.tsx` defaulting strictly to **OFF (`false`)**.
   - Clear label and subtitle: *"Disclose whether this video promotes yourself, a brand, product, or service."*
2. **"Your brand" & "Branded content" Sub-Options**:
   - Checkboxes appear when disclosure is enabled.
   - **"Your brand"**: Sets `brandOrganicToggle: true`. Classified as Brand Organic (Promotional content label on TikTok).
   - **"Branded content"**: Sets `brandContentToggle: true`. Classified as Paid partnership (Paid partnership label on TikTok).
   - Multi-selection supported (either or both).
3. **Publish Button Disabling & Helper Prompt**:
   - If disclosure is ON but neither option is selected:
     - Publish Now and Schedule Post buttons are reactively disabled.
     - Displays prompt: *"You need to indicate if your content promotes yourself, a third party, or both."*
4. **Branded Content Privacy Restriction**:
   - When `brandContentToggle === true`:
     - Dropdown option `SELF_ONLY` ("Only Me (Private)") is disabled and unclickable.
     - If user had `SELF_ONLY` selected, it is automatically cleared and a warning alert is displayed: *"Branded content visibility cannot be set to private."*
5. **API Payload Mapping**:
   - `integrations/tiktok/index.ts`: Injects `brand_organic_toggle` and `brand_content_toggle` into `post_info` for `/v2/post/publish/video/init/`.
   - `app/api/posts/route.ts` & `app/api/posts/bulk/route.ts`: Validates Point 3 rules on the backend and serializes toggles into `platformPosts.metadata`.
6. **Creator Profile Header**:
   - Added dedicated profile card in the TikTok composer displaying creator avatar, nickname, `@handle`, and connection status badge.
7. **Automated Test Suite**:
   - Created `tests/tiktok-point3-commercial-content.test.ts` covering 10 distinct edge cases (empty privacy, incomplete disclosure, your brand public/private, branded content public/private, dual selection public/private, inbox draft bypass, and normal organic post). All 10 passed.



---

## 10. Implementation Log: Point 4 (Compliance Declarations & Remaining UX Requirements)

**Status:** ✅ **Fully Implemented & Verified (All 10 Test Scenarios Passed)**

### 10.1 Point 4 Compliance Declarations Implemented
1. **Normal Content (Commercial Disclosure OFF)**:
   - Declaration: *"By posting, you agree to TikTok's [Terms of Service](https://www.tiktok.com/legal/page/global/terms-of-service/en) and confirm that your content complies with TikTok's [Community Guidelines](https://www.tiktok.com/community-guidelines/en)."*
   - Rendered with verified external links (`target="_blank"`, `rel="noopener noreferrer"`).
2. **"Your brand" Promotional Content**:
   - Declaration: *"By posting, you agree to TikTok's [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
3. **"Branded content" (Paid Partnership)**:
   - Declaration: *"By posting, you agree to TikTok's [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) and [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
4. **Both Commercial Options Selected**:
   - Declaration: *"By posting, you agree to TikTok's [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en) and [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)."*
5. **Multi-Surface Display**:
   - The compliance declaration is rendered dynamically in four distinct high-visibility surfaces:
     1. Inside the **TikTok Settings panel** immediately beneath the Commercial Content Disclosure box.
     2. In the **bottom composer action bar** directly above the Post Now / Schedule action buttons whenever TikTok is among the selected target channels.
     3. Inside the **Publish Confirmation Modal** (`showPublishConfirmModal`) preceding final user authorization.
     4. Inside the **Schedule Review Confirmation Step** (`showScheduleModal` step `CONFIRM`).

### 10.2 Verification of All 10 Direct Post UX Requirements
| # | Requirement | Implementation Details | Verified Status |
|---|-------------|------------------------|-----------------|
| **1** | **Creator Info & Account Identification** | Header card renders creator avatar, nickname, `@username`, and Direct Post connection badge. Confirmation modal displays connected creator handle. | ✅ Verified |
| **2** | **Dynamic Privacy Options** | Populated dynamically from `privacy_level_options` returned by `/v2/post/publish/creator_info/query/`. Starts empty (no preselected default). `SELF_ONLY` disabled when Branded Content is selected. | ✅ Verified |
| **3** | **Interaction Restrictions** | Comments, Duet, and Stitch default to unchecked. If Creator Info API returns `comment_disabled`, `duet_disabled`, or `stitch_disabled`, UI checkboxes are locked/disabled with label *"Disabled by creator account in TikTok"*. | ✅ Verified |
| **4** | **Video Caption & Upload Constraints** | Strictly validates video media (.mp4, .mov, .webm) on both frontend and backend (`app/api/posts/route.ts`, `app/api/posts/bulk/route.ts`, and `integrations/tiktok/index.ts`). Rejects missing media (`TIKTOK_MEDIA_REQUIRED`) and non-video images (`TIKTOK_MEDIA_TYPE_INVALID`). | ✅ Verified |
| **5** | **Commercial Disclosure Validation** | When disclosure is switched ON, publishing is blocked if neither brand option is selected with prompt: *"You need to indicate if your content promotes yourself, a third party, or both."* | ✅ Verified |
| **6** | **User Review & Explicit Confirmation** | Two-step affirmative review before publishing: `showPublishConfirmModal` for instant publishing and `scheduleStep === 'CONFIRM'` for scheduled broadcasting. | ✅ Verified |
| **7** | **Clear Pending, Success, & Error States** | Spinners during upload/initiation; detailed success cards displaying TikTok's 2–5 minute video transcoding & moderation notice: *"TikTok is processing and transcoding your video. Video moderation and processing typically take 2 to 5 minutes before the post becomes visible on your profile."* Exact TikTok error codes surfaced. | ✅ Verified |
| **8** | **Direct Post vs. Creator Inbox Distinction** | Clear segmented toggle in TikTok settings: Direct Post publishes directly to creator's feed according to privacy selection; Creator Inbox uploads as a draft for final editing in TikTok app. | ✅ Verified |
| **9** | **Required API Request Fields & Payload Mapping** | Injects `post_info` containing `title`, `privacy_level`, `disable_comment`, `disable_duet`, `disable_stitch`, `brand_organic_toggle`, and `brand_content_toggle`. | ✅ Verified |
| **10** | **No Unauthorized Auto-Publishing** | Publishing never occurs automatically in the background; strictly requires creator's click on "Publish Now" or explicit schedule configuration. | ✅ Verified |

### 10.3 Automated Test Suite
- Test file: `tests/tiktok-point4-compliance.test.ts`
- Results: **10/10 Passed (100%)**
  - Scenario 1: Normal Content ToS & Community Guidelines links.
  - Scenario 2: "Your Brand" Music Usage Confirmation.
  - Scenario 3: "Branded Content" Branded Content Policy & Music Usage Confirmation.
  - Scenario 4: Both Commercial Content options.
  - Scenario 5: Missing media rejected with `TIKTOK_MEDIA_REQUIRED`.
  - Scenario 6: Image media rejected with `TIKTOK_MEDIA_TYPE_INVALID`.
  - Scenario 7: Valid video Direct Post succeeds in mock mode.
  - Scenario 8: Creator Inbox Draft bypasses Direct Post constraints.
  - Scenario 9: Privacy options validated against creator capabilities.
  - Scenario 10: Interaction settings respect disabled flags from Creator Info API.
