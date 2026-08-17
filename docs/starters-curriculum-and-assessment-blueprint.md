# Starters Curriculum And Assessment Blueprint

**Status:** Draft for academic and product approval  
**Scope:** Web responsive/PWA v1, Pre A1 Starters practice; teacher-led speaking in a later v1.x release.  
**Last reviewed:** 2026-08-17

## 1. Purpose

This document defines the curriculum constraints and assessment behaviour for the first Cambridge YLE-aligned product scope: Pre A1 Starters.

The product provides original practice material aligned to the skills and task formats described in the teacher handbook. It is not an official Cambridge English product, does not issue certificates, and must not copy, publish, or adapt protected test text, images, audio, layouts, or answer keys.

The first product goal is to make online practice useful for an offline teacher: every response must produce enough skill, part, vocabulary, and grammar evidence for the teacher to decide what to reinforce in class.

## 2. Source References And Content Policy

### 2.1 Internal references

- `docs/cambridge-young-learners-handbook.md`
  - Starters paper lengths, part counts, task formats, speaking flow, and assessment scale.
- `docs/cambridge-young-learners-wordlist.md`
  - Starters vocabulary, names, numbers, grammatical categories, and cumulative level rules.

The imported Word List is labelled "for exams from 2018". The academic lead must confirm that it remains suitable before any public curriculum claim or large-scale content generation.

### 2.2 Content rules

- All student-facing questions, examples, scripts, illustrations, recordings, and feedback are original, licensed, or generated for this product and approved by a teacher.
- The app may say that practice is aligned to relevant YLE skills and formats only after legal/academic wording is approved.
- The app must not present results as a Cambridge result, certificate, shield, pass, or fail.
- Imported vocabulary data is an internal curriculum reference. The product must not expose or export the source word list as a downloadable branded feature without permission.

## 3. Starters Assessment Map

The handbook describes Starters as approximately 45 minutes overall: Listening is approximately 20 minutes with 20 items; Reading and Writing is 20 minutes with 25 items; Speaking is 3-5 minutes with four parts.

### 3.1 Listening

| Part | Items | Task | Product engine | Response | Primary evidence |
| --- | ---: | --- | --- | --- | --- |
| 1 | 5 | Match names to people in a scene | `scene_matching` | Assign each name to one scene region | Listening for identifying people; names |
| 2 | 5 | Write dictated numbers (1-20) and spelled names | `audio_note_taking` | Short number or name field | Number recognition; letter/name spelling |
| 3 | 5 | Choose one of three picture options | `audio_picture_choice` | Select A, B, or C | Listening for specific information |
| 4 | 5 | Locate objects and colour them from directions | `audio_colour_scene` | Choose colour, then select region | Listening for instructions, colours, positions |

### 3.2 Reading And Writing

| Part | Items | Task | Product engine | Response | Primary evidence |
| --- | ---: | --- | --- | --- | --- |
| 1 | 5 | Decide whether a sentence matches a picture | `picture_true_false` | Tick or cross | Word and sentence recognition |
| 2 | 5 | Decide whether a picture statement is correct | `picture_yes_no` | `yes` or `no` | Reading comprehension from a scene |
| 3 | 5 | Unscramble letters to write pictured words | `picture_word_unscramble` | One word | Spelling and vocabulary production |
| 4 | 5 | Select and copy words from a box into a text | `word_bank_cloze` | Assign word to blank | Reading in context; vocabulary |
| 5 | 5 | Answer one-word questions about a three-picture story | `picture_story_short_answer` | One word | Reading comprehension and controlled writing |

### 3.3 Speaking

| Part | Teacher-led task | Candidate action | v1.x product support |
| --- | --- | --- | --- |
| 1 | Scene picture and object cards | Point to scene regions and place object cards as directed | `teacher_speaking_scene` |
| 2 | Scene picture prompts | Give short answers, including a "Tell me about..." prompt | `teacher_speaking_scene` |
| 3 | Object-card prompts | Answer questions about four cards | `teacher_speaking_cards` |
| 4 | Personal prompts | Answer questions about age, family, school, and friends | `teacher_speaking_personal` |

Speaking is not in the first self-directed practice release. The first speaking feature is a teacher-led offline flow, not an automatic AI score.

## 4. Delivery Modes And Release Boundaries

### 4.1 Practice mode: v1 pilot

Practice sets are 5-10 minute activities targeting one paper part and one or two learning objectives. They may permit replay and give feedback after a question or section.

Pilot release engines, in order:

1. `picture_true_false`
2. `picture_yes_no`
3. `audio_picture_choice`
4. `audio_note_taking`
5. `word_bank_cloze`
6. `scene_matching`
7. `picture_word_unscramble`
8. `picture_story_short_answer`
9. `audio_colour_scene`

The order is implementation priority, not a claim that later formats are less important academically. `audio_colour_scene` is deferred only because it needs a touch-safe, semantically gradable scene interaction.

### 4.2 Mock-style mode: later milestone

An assessment may be labelled **full Starters-style mock** only when it includes all four Listening parts and all five Reading and Writing parts, preserves the stated item counts, and applies a defined timing and audio playback policy.

Until then, call content a `practice set`, `part practice`, or `diagnostic`, never a full mock test.

### 4.3 Audio policy

| Mode | Replay | Feedback | Timer |
| --- | --- | --- | --- |
| Practice | Per-item or per-section replay allowed | Immediate or after section | Optional, never punitive |
| Mock-style | Playback policy set by test template; no arbitrary seek/skip | After submission | Paper-level timer |

Audio, images, and scene metadata required for a set must preload before the learner starts. The UI must display a clear download/error state rather than start with missing media.

## 5. Cumulative Curriculum Framework

### 5.1 Vocabulary rule

The Word List explicitly states:

- Starters candidates are expected to understand and use the Starters vocabulary.
- Movers candidates are expected to know all Starters words plus Movers additions.
- Flyers candidates are expected to know all Starters and Movers words plus Flyers additions.

Vocabulary is therefore cumulative:

```text
Starters allowed vocabulary = Starters entries
Movers allowed vocabulary = Starters entries + Movers additions
Flyers allowed vocabulary = Starters entries + Movers additions + Flyers additions
```

Each vocabulary item has one canonical record and one `introduced_at_level`. It must not be duplicated per level.

### 5.2 Grammar rule

Grammar is also cumulative. The handbook defines Movers as additions to Starters and Flyers as additions to Starters and Movers.

For Starters, the framework must at least cover:

- Singular/plural nouns, including selected irregular forms.
- Adjectives and possessive adjectives.
- Determiners and pronouns.
- Present simple and present continuous.
- `can` for ability and requests.
- `have (got)` for possession.
- Imperatives and short answers.
- Adverbs, conjunctions, prepositions of place/time, and question words.
- `there is / there are`, `would like`, `like + -ing`, and other approved key phrases.

### 5.3 Required tags for every item

```text
level: starters
paper: listening | reading_writing | speaking
part: 1..5
task_type
primary_language_target_ids[]
supporting_vocabulary_ids[]
introduced_vocabulary_ids[]
primary_grammar_target_ids[]
supporting_grammar_target_ids[]
topic_ids[]
```

`introduced_vocabulary_ids` is permitted only in a teaching/practice context with pre-teach support. It must not become the unstated barrier to an assessment item.

### 5.4 Content validation

Before a question can be reviewed, automated validation must report:

- Words outside the cumulative vocabulary allowed at the requested level.
- Grammar targets that exceed the requested level.
- Names and number forms outside the approved Starters list/range.
- Sentence length and option count outside task-template limits.
- Missing target tags, answer keys, alternatives, or required media.

Validation flags items for review; the academic lead decides whether a flagged exception is acceptable.

## 6. Question, Response, And Scene Model

### 6.1 Question record

```text
Question
- id, status: draft | in_review | approved | published | retired
- level, paper, part, task_type
- instructions, stem, options, answer_key
- target/supporting vocabulary and grammar tags
- topic tags, difficulty, estimated_time_seconds
- media_asset_ids, scene_id (optional)
- answer_policy_id
- authored_by, reviewed_by, version
- generation_metadata (optional)
```

### 6.2 Answer policy

The system must use deterministic scoring for Listening and Reading/Writing responses. No LLM decides correctness for these closed or short controlled responses.

```text
AnswerPolicy
- input_kind: choice | boolean | yes_no | number | name | word | assignment | colour_region
- canonical_answer
- accepted_answers[]
- case_sensitive: false by default
- trim_whitespace: true
- normalize_punctuation: true
- normalize_number_forms: defined per item
- max_words
- teacher_review_if_uncertain
```

For a short-answer field, report the response as `correct`, `incorrect`, or `needs_teacher_review`; never silently turn an uncertain answer into correct.

### 6.3 Interactive scenes

```text
InteractiveScene
- image_asset_id
- alt_text
- regions[]
  - id
  - semantic_label_for_author
  - geometry: polygon or mask
  - allowed_actions: match | select | colour | place_card
  - accepted_answer_keys[]
  - allowed_colour_ids[]
  - required_colour_id (optional)
```

For scene matching, the learner selects a name then taps a person/region. For colouring, the learner selects a colour then taps a defined region. The app records semantic assignments, not freehand lines or pixels.

## 7. Media And Asset Requirements

### 7.1 Asset types

| Asset type | Purpose | Approval requirement |
| --- | --- | --- |
| `vocabulary_card` | Introduce one word clearly | One unambiguous referent, child-safe |
| `assessment_image` | Test recognition or selection | One defensible answer; fair distractors |
| `scene_image` | Matching, colour, reading scene, speaking | Clear regions; usable at phone size |
| `picture_story` | Reading Part 5 | Sequence understandable without copied source material |
| `pronunciation_audio` | Hear a word | Approved voice, accent, transcript |
| `listening_audio` | Listening part | Script, timing, answer key, quality review |

### 7.2 Listening asset record

```text
ListeningAsset
- audio_file
- script_for_teacher
- voice/accent
- duration_seconds
- playback_policy
- item_cue_timestamps (optional)
- answer_key_version
- approved_by, approval_status
```

### 7.3 Asset QA checklist

- No copyrighted source-page artwork, audio, script, or layout is reused.
- An image has a single intended answer for the associated item.
- Image text is avoided unless text is the explicit target.
- Scene targets remain distinguishable on a phone viewport.
- Audio is audible, paced for Starters, and matches the approved script/answer key.
- Alternative text exists for teacher/admin use; a task is not published if accessibility would reveal the answer to the learner.

## 8. Scoring, Progress, And Teacher Evidence

### 8.1 Practice scoring

Store every response, including answer, correctness, time, retry count, media playback events, and item version. Do not retain only total score.

Progress views must aggregate at minimum by:

- Paper: Listening, Reading and Writing, Speaking.
- Part: for example, Listening Part 2.
- Language target: vocabulary, grammar, spelling, numbers, names, colours, positions.
- Topic: animals, colours, food and drink, home, school, family and friends, toys, transport, weather, and other approved topics.

Use product-owned labels such as `secure`, `building`, `needs practice`, and `not assessed yet`. Do not use pass/fail, certificates, or shield icons.

### 8.2 Teacher-led speaking record

The Starters speaking form uses three product criteria derived from the handbook's assessment categories:

```text
SpeakingObservation
- vocabulary_score: 0..5
- pronunciation_score: 0..5
- interaction_score: 0..5
- support_required: none | light | frequent
- teacher_note
- prompt_set_version
- recording_asset_id: optional and consent-gated
```

These records support teaching decisions. They are not Cambridge scores and must be labelled as teacher practice observations.

## 9. Content Workflow

```text
Author or AI creates a draft
-> schema and curriculum validator runs
-> content editor checks task, answer, grammar, vocabulary, and media
-> academic lead approves
-> mobile preview passes
-> publish
-> monitor response quality and retire/revise weak items
```

AI may generate structured drafts only. It cannot publish material, approve its own output, or determine correctness of student answers.

## 10. Acceptance Criteria

### 10.1 Pilot release

- A teacher can publish original Starters practice sets for the implemented task engines.
- Every published item has level, paper, part, target vocabulary/grammar, answer policy, and approved assets.
- A learner can complete a set reliably on a phone and desktop browser.
- Every learner response is stored at item level and is visible in the teacher dashboard.
- The teacher can identify a learner's weakest implemented paper parts and language targets before the offline session.
- The app clearly distinguishes practice results from official exam results.

### 10.2 Full mock-style milestone

- All 4 Listening parts and all 5 Reading and Writing parts are implemented.
- The system creates a 20-item Listening paper and a 25-item Reading and Writing paper from approved items.
- Audio, answer-key, timing, and media preload policies are enforced by the test template.
- The result report breaks down evidence by paper, part, vocabulary/grammar target, and topic.
- Academic lead signs off the format and content QA checklist before learner access.

## 11. Decisions Needed Before Implementation

1. Confirm the academic lead and the source/version approval process for the imported curriculum references.
2. Choose the initial pilot topics and grammar targets for the first 50-100 original items.
3. Decide which five task engines form the first pilot release and whether the pilot includes `scene_matching`.
4. Define the child-facing feedback policy: immediate, after section, or after submission for each practice template.
5. Define parent consent, retention, access, and deletion policy before storing any speaking recording.
6. Approve the public wording that describes alignment without implying official Cambridge endorsement.
