# Share Components

Shareable cards for growth and referrals.

## Components

### PostRoundRecapCard
Screenshot-friendly post-round recap. Perfect for social media sharing (Instagram stories, Twitter, etc.).

**Features:**
- Large score display with color-coded result (green < par, yellow = par, red > par)
- Course name and player handicap
- Par conversion %, best hole, worst hole
- 3 key lessons from the round
- AI Caddie branding and CTA

**Usage:**
```tsx
import { PostRoundRecapCard, sharePostRoundCard } from './components/share/PostRoundRecapCard';

<PostRoundRecapCard
  playerName="Sarah"
  courseName="Riviera Country Club"
  score={88}
  par={72}
  handicap="18"
  keyLessons={[
    "3-wood strategy on par 4s worked—converted 2 pars",
    "Doubles came from hero shots—lay up next time",
    "Sand play cost 4 strokes—practice bunker shots"
  ]}
  bestHole={2}
  worstHole={12}
  parConversion={67}
/>
```

**Share:**
```tsx
await sharePostRoundCard(cardHtml, 'Riviera', 88);
```

---

### PreRoundPlaybookCard
Game plan before the round. Shows goals, mental keys, and critical holes.

**Features:**
- Course name, tee, par
- Today's goal score (prominent display)
- Mental keys from pre-round talk
- 3-5 critical holes with key tips
- AI Caddie branding

**Usage:**
```tsx
import { PreRoundPlaybookCard } from './components/share/PreRoundPlaybookCard';

<PreRoundPlaybookCard
  playerName="Michael"
  courseName="Trump National Golf Club"
  teeName="Championship"
  par={72}
  goal={89}
  preRoundTalk="Trust your 3-wood. Play smart. One shot at a time."
  topHoles={[
    { hole: 7, par: 4, keyTip: "3-wood, aim left center" },
    { hole: 12, par: 3, keyTip: "Par chance—solid 6-iron" },
    { hole: 18, par: 5, keyTip: "Lay up to 150, birdie zone" }
  ]}
/>
```

---

### HoleStrategyCard
Single hole strategy. Perfect for showcasing a specific decision.

**Features:**
- Hole number, par, yardage (hero display)
- Aim point (large, prominent)
- Tee club and carry distance
- Key tips for execution
- Terrain warning (if applicable)
- Danger zones
- Square format (Instagram feed friendly)

**Usage:**
```tsx
import { HoleStrategyCard } from './components/share/HoleStrategyCard';

<HoleStrategyCard
  hole={7}
  par={4}
  yardage={385}
  courseName="Riviera Country Club"
  aimPoint="Left center fairway, avoid right bunker"
  teeClub="3-Wood"
  carryTarget={210}
  keyTips={[
    "Fairway slopes right—ball feeds toward bunker",
    "Approach from 155—elevated green, tough from above",
    "Par is a win—no hero shots"
  ]}
  terrain="Fairway valley at 190 makes hole play longer"
  danger="Right bunker at 220, back bunker behind green"
/>
```

---

## Integration Points

### Post-Round Flow
After player saves their round:
1. Show "Generate Share Card" button in summary screen
2. On tap: Generate `PostRoundRecapCard` with:
   - Round data (score, par, pars/doubles/birdies)
   - Review data (3 key lessons from ai-caddie-3)
   - Player profile (name, handicap)
3. Convert to image using `expo-print`
4. Open share sheet using `expo-sharing`

### Pre-Round Flow
Before player starts a round:
1. Show "Share Your Plan" button on playbook screen
2. On tap: Generate `PreRoundPlaybookCard` with:
   - Playbook data (course, tee, par)
   - Goal score from profile
   - Pre-round talk
   - Top 3-5 holes (par chances + dangerous holes)
3. Convert to image and share

### Hole-by-Hole
On individual hole card:
1. Add "Share This Hole" button
2. On tap: Generate `HoleStrategyCard` for current hole
3. Share as image

---

## Design Notes

- **Color scheme:** Matches app brand (green-deep, gold, cream)
- **Typography:** Serif for scores/numbers (matches app)
- **Dimensions:**
  - Post-round + Pre-round: 1080x1920px (Instagram story / portrait)
  - Hole strategy: 1080x1350px (Instagram square)
- **Content:** Aggressive branding (AI Caddie logo, "Break 90" CTA)
- **Purpose:** Viral growth—cards should make recipients want to try the app

---

## Next Steps

- [ ] Implement full card generation with real data from rounds
- [ ] Add `variant="secondary"` button style to Button component if needed
- [ ] Test card rendering on device (HTML-to-image conversion)
- [ ] Add analytics: track shares, share→signup conversion
- [ ] Optional: Add customization UI (choose colors, add custom text)
- [ ] Optional: Add watermark or QR code linking to download page

---

