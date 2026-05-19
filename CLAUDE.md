# Mayven Executive Dashboard — Project Context

## הקובץ הזה נטען אוטומטית בכל סשן. לא לשנות ידנית.

---

## קובץ הדשבורד

`executive-dashboard.html` — קובץ אחד, GitHub Pages:
`https://nks-group-ltd.github.io/mayven-monday-automation/executive-dashboard.html`

כל שינוי → `git add executive-dashboard.html && git commit -m "..." && git push`

---

## ארכיטקטורת נתונים

### Supabase (נתוני Hub)
- **Data project:** `hrdniczngcoymqjpmvqn` — טבלאות `items` + `column_values`
- **Functions project:** `syrhxhytlkcnakicnyde` — Edge Functions
- **Anon key (data):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZG5pY3puZ2NveW1xanBtdnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQ3NjMsImV4cCI6MjA5NDM0MDc2M30.Z7ieddQrShW2fInB43BSHYQI1IdpxVqrJSY3npZkTnQ`

### Hub Board
- Board ID: `18400570216`
- מכיל את כל המשימות של כל הפרויקטים
- מסונכרן ל-Supabase על ידי `hub-sync` Edge Function (כל 30 דקות + לחצן רענן)

### Pipeline Board (טכנולוגיה)
- Board ID: `18404945843`
- נשלף חי מ-Monday API דרך `pipeline-fetch` Edge Function

---

## Column IDs — Hub Board (`const C`)

```javascript
BOARD_NAME:      'text_mm1rz19m'      // שם הפרויקט/בורד המקור
GROUP_NAME:      'text_mm1sma80'
PROJECT_TYPE:    'color_mm3a8hzs'     // סוג הפרויקט
TEAM:            'multiple_person_mm0pfs7x'
OWNER:           'multiple_person_mm0pepdk'
MANAGER_APPROVAL:'multiple_person_mm0pwp6q'
CREATED_BY:      'multiple_person_mm0p6kqe'
BUSINESS_OWNER:  'multiple_person_mm3e4yy4'
STATUS:          'color_mm0pdjry'     // סטטוס משימה
DEV_STATUS:      'color_mm1jhvap'
DEV_PRIORITY:    'color_mm1rz2vt'
PRIORITY:        'color_mm0prghm'
DEV_TYPE:        'color_mm3e690x'
DEV_STAGE:       'color_mm3e98bb'
ENVIRONMENT:     'dropdown_mm3ezsvq'
STRATEGIC_GOAL:  'dropdown_mm3ersa1'
BIZ_IMPACT:      'color_mm3emh6c'
QUARTER_T:       'dropdown_mm3eqtpn'
DEPARTMENT_T:    'color_mm3en599'
COMPLETION_DATE: 'date_mm0p2hfk'
BASELINE_DATE:   'date_mm0pzjaw'
LAUNCH_TYPE:     'color_mm0prghm'
ON_TIME:         'color_mm1rgerb'
DEADLINE:        'date_mm0ppepz'
TIMELINE:        'timerange_mm0pbdag'
EFFORT:          'numeric_mm0pr6mf'
PLANNED:         'numeric_mm0p7e5k'
FIX_ROUNDS:      'numeric_mm0ppf5f'
QUARTER:         'color_mm2jkkq1'
```

## Column IDs — Pipeline Board (`const P`)

```javascript
DEV_STAGE:    'color_mm1qp21h'
DEPARTMENT:   'color_mm1qefj4'
DEV_TYPE:     'color_mm1qbd4z'
OWNER:        'multiple_person_mm1pr59g'
PM:           'multiple_person_mm1qy0em'
DEADLINE:     'date_mm1p37v8'
TIMELINE_PLAN:'timerange_mm1q7amw'
STATUS:       'color_mm1qz36p'
EFFORT_PLAN:  'numeric_mm1p1jfe'
EFFORT_ACT:   'numeric_mm1xewhy'
```

---

## סוגי פרויקטים → עמודים

```javascript
TYPE_TO_WORLD = {
  '🌀Changing Projects🔄': 'other',
  '✨ Department':         'departments',
  '🔬 Tech Project':       'tech',
  '🛍️ New Product':        'product',
  // ...
}
```

מחלקות (Department) = boards עם "Team" בשם בלבד. לינקדאין מוחרג.

---

## ערכי STATUS נפוצים

```
בנק משימות | ממתין | מאושר | בעבודה | הסתיימה | מבוטלת | דגל אדום
```

---

## Design System

```css
--ink:          #1A1D23
--paper:        #F5F0E8
--paper-deep:   #EDE8E0
--paper-shade:  #E8E3DB
--accent:       #D05A72    /* ורוד-אדום */
--accent2:      #22c55e
--red-fg:       #b91c1c
--red-bg:       #fee2e2
--yellow-fg:    rgba(180,83,9,1)
--yellow-bg:    rgba(253,246,178,.4)
--green-fg:     #15803d
--green-bg:     #dcfce7
```

**פונטים:** `Suez One` (כותרות/מספרים גדולים) · `Heebo` (טקסט) · `JetBrains Mono` (ערכים/קוד)

**Neobrutalist style:** border `1.5px solid var(--ink)` + `box-shadow: 3px 3px 0 var(--ink)` על כרטיסים.

---

## כלל בידוד עמודים — חובה לקרוא

**כל עמוד עצמאי לחלוטין.** אסור לגעת ב:
- `processItems()` — לוגיקה גלובלית לעמוד Overview בלבד
- `applyFilters()` — dispatcher גלובלי
- `WORLDS`, `TYPE_TO_WORLD` — לא לשנות ערכים קיימים

**כן מותר:**
- לערוך את ה-render function של העמוד שלך בחופשיות מלאה
- להוסיף `processXxx(window.__rawItems)` function ייחודית לעמוד
- להוסיף CSS classes חדשים עם prefix ייחודי (`.tech-`, `.prod-`, `.dept-`)
- להוסיף helper functions עם שם שלא מתנגש

---

## עמודים — מצב נוכחי

| עמוד | Function | עצמאי? | נתונים |
|------|----------|--------|--------|
| Overview | `renderOverview(ps)` | ⚠️ תלוי ps | Hub |
| Pipeline | `renderPipeline(pipelineProjects)` | ✅ | Monday API live |
| טכנולוגיה | `renderTechPage(ps)` | ⚠️ תלוי ps | Hub |
| מוצר חדש | `renderProductPage(ps)` | ⚠️ תלוי ps | Hub |
| מחלקות | `renderDepartmentsPage()` | ✅ | `window.__rawItems` |
| Roadmap | `renderRoadmap(ps)` | ⚠️ תלוי ps | Hub |

`window.__rawItems` = מערך הגולמי של כל פריטי ה-Hub — זמין בכל render function.

---

## גלובלים חשובים

```javascript
allProjects      // פרויקטים מעובדים (processItems output)
pipelineProjects // Pipeline מעובד (processPipeline output)
window.__rawItems // raw Hub items — להשתמש בזה לעמודים עצמאיים
activeWorld      // 'overview' | 'pipeline' | 'tech' | 'product' | 'departments' | ...
```

---

## איך לעבוד על עמוד ספציפי

1. קרא את ה-`render function` של העמוד בקובץ
2. כל שינוי — רק בתוך ה-function הזו ובפונקציות עזר שתוסיף
3. לא לגעת בשום דבר מחוץ ל-scope שלה
4. בסוף: `git add executive-dashboard.html && git commit && git push`

---

## Portfolio Boards שעוד לא מחוברים

| עמוד | Board ID | מה חסר |
|------|----------|--------|
| מוצר חדש | 18396188556 | edge function + join לנתוני Hub |
| קמפיינים | TBD | להגדיר |
| A/B Tests | TBD | להגדיר |
