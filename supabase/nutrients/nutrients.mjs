// The micronutrients Progresso tracks (explicitly requested): the source of truth for their
// definitions, where their reference values are in Health Canada's tables, where their amounts
// come from in each food database, and what the app says about them.
//
// Nothing here is a reference value. Every recommendation, upper limit and qualification is read
// by generate.mjs from sources/health-canada-dri.json -- Health Canada's tables as published,
// fetched by fetch_dri.py -- by the column named here. Every explanation is a plain-language
// rewording of the source it names, which was read when it was written; a section with no source
// that could be read is null, and the app says so rather than filling it in. `npm run
// db:nutrients` checks all of it and writes the app's catalogue, the API's food-data mapping and
// the reference migration -- never edit those by hand.

/** Sources the explanations are reworded from, each read in full when its text was written. */
export const SOURCES = {
  hc_vitamins: {
    publisher: 'Health Canada',
    title: 'Dietary reference intakes tables: Reference values for vitamins',
    url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html',
  },
  hc_elements: {
    publisher: 'Health Canada',
    title: 'Dietary reference intakes tables: Reference values for elements',
    url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html',
  },
  hc_macronutrients: {
    publisher: 'Health Canada',
    title: 'Dietary reference intakes tables: Reference values for macronutrients',
    url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html',
  },
  ...Object.fromEntries(
    [
      ['vitamin_a', 'Vitamin A', 'article/002400', '2025-01-21'],
      ['vitamin_c', 'Vitamin C', 'article/002404', '2025-01-21'],
      ['vitamin_d', 'Vitamin D', 'article/002405', '2025-01-21'],
      ['vitamin_e', 'Vitamin E', 'article/002406', '2025-01-21'],
      ['vitamin_k', 'Vitamin K', 'article/002407', '2025-01-21'],
      ['thiamin', 'Thiamin', 'article/002401', '2025-01-21'],
      ['riboflavin', 'Riboflavin', 'article/002411', '2025-01-21'],
      ['niacin', 'Niacin', 'article/002409', '2025-01-21'],
      ['pantothenic_biotin', 'Pantothenic acid and biotin', 'article/002410', '2025-01-21'],
      ['vitamin_b6', 'Vitamin B6', 'article/002402', '2025-01-21'],
      ['folate', 'Folic acid in diet', 'article/002408', '2025-02-03'],
      ['vitamin_b12', 'Vitamin B12', 'article/002403', '2025-01-21'],
      ['calcium', 'Calcium in diet', 'article/002412', '2025-01-21'],
      ['iron', 'Iron in diet', 'article/002422', '2025-01-21'],
      ['magnesium', 'Magnesium in diet', 'article/002423', '2025-01-21'],
      ['zinc', 'Zinc in diet', 'article/002416', '2025-01-21'],
      ['potassium', 'Potassium in diet', 'article/002413', '2026-04-30'],
      ['sodium', 'Sodium in diet', 'article/002415', '2026-04-30'],
      ['phosphorus', 'Phosphorus in diet', 'article/002424', '2025-01-21'],
      ['selenium', 'Selenium in diet', 'article/002414', '2025-01-21'],
      ['copper', 'Copper in diet', 'article/002419', '2025-01-21'],
      ['iodine', 'Iodine in diet', 'article/002421', '2025-01-21'],
      ['chromium', 'Chromium in diet', 'article/002418', '2025-01-21'],
      ['fibre', 'Fiber', 'article/002470', '2026-07-22'],
      ['saturated_fat', 'Facts about saturated fats', 'patientinstructions/000838', '2026-04-30'],
      ['trans_fat', 'Facts about trans fats', 'patientinstructions/000786', '2026-04-30'],
      ['fats_explained', 'Dietary fats explained', 'patientinstructions/000104', '2024-07-24'],
    ].map(([key, title, path, reviewed]) => [
      `mlp_${key}`,
      {
        publisher: 'MedlinePlus (U.S. National Library of Medicine)',
        title: `${title}: MedlinePlus Medical Encyclopedia`,
        url: `https://medlineplus.gov/ency/${path}.htm`,
        reviewed,
      },
    ]),
  ),
};

/**
 * Each nutrient, in the order the app lists it.
 *
 * - `unit`: what amounts and reference values are kept and shown in -- Health Canada's own unit
 *   for it ("μg" written "mcg").
 * - `basis`: how the amount is counted, as Health Canada's table counts it (RAE, DFE, ...).
 * - `dri`: where its values are -- the page, the table, the column heading -- and, where a column
 *   comes in two units, which (`unitColumn`); `iu` also reads the IU columns, for showing both.
 *   Null for a nutrient Health Canada gives guidance for but no number (`guidance`).
 * - `usda`: FoodData Central nutrient ids to read, the first a food has winning, and their unit
 *   (from FoodData Central's own nutrient.csv).
 * - `openFoodFacts`: the product field, and whether a 0 there is a real figure -- only for what a
 *   nutrition label must declare. Elsewhere a 0 is a field left at 0, so it's read as unknown.
 *   Null where label units can't be trusted to match Health Canada's basis.
 * - `note`: a qualification of how the logged amount compares with the reference.
 * - `ulOnlySupplements`: Health Canada's UL for it isn't about food (its footnote says it covers
 *   supplements, fortified foods or medicines only, or a form a food log can't tell apart), so a
 *   logged total is never compared with it.
 * - `about`: what it does, too little, too much -- each with the sources it's reworded from.
 */
export const NUTRIENTS = [
  {
    id: 'vitamin_a',
    ulOnlySupplements: true,
    name: 'Vitamin A',
    category: 'vitamin',
    unit: 'mcg',
    basis: 'RAE',
    dri: { page: 'vitamins', table: 0, column: 'Vitamin A', unitColumn: 'μg/day' },
    usda: { ids: [1106], unit: 'UG' },
    openFoodFacts: null,
    about: {
      does: {
        text: 'Helps form and maintain healthy teeth, bones, soft tissue, mucous membranes and skin, and supports good eyesight, especially in low light. It also has a role in a healthy pregnancy and breastfeeding.',
        sources: ['mlp_vitamin_a'],
      },
      low: {
        text: 'Not getting enough raises the risk of eye problems such as night blindness and, over time, lasting damage to the cornea (xerophthalmia). It can also cause dry, scaly skin.',
        sources: ['mlp_vitamin_a'],
      },
      high: {
        text: 'Vitamin A can build up in the body and cause serious illness, and large doses in pregnancy can cause birth defects. Poisoning usually comes from taking large doses: chronic poisoning may occur in adults who regularly take more than 33,000 IU a day. Large amounts of beta-carotene from plant foods won’t make you seriously ill, but can turn the skin yellow or orange.',
        sources: ['mlp_vitamin_a', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'vitamin_c',
    name: 'Vitamin C',
    category: 'vitamin',
    unit: 'mg',
    dri: { page: 'vitamins', table: 1, column: 'Vitamin C' },
    usda: { ids: [1162], unit: 'MG' },
    openFoodFacts: { key: 'vitamin-c', zero: false },
    about: {
      does: {
        text: 'Needed to grow and repair tissue all over the body: it’s used to make collagen for skin, tendons, ligaments and blood vessels, to heal wounds, to maintain cartilage, bones and teeth, and to absorb iron. It’s also an antioxidant. Your body can’t make or store it, so it needs to come from food regularly.',
        sources: ['mlp_vitamin_c'],
      },
      low: {
        text: 'Too little can cause bleeding gums, easy bruising, slow wound healing, rough dry skin, swollen and painful joints, nosebleeds and a weaker ability to fight infection. A severe deficiency is called scurvy.',
        sources: ['mlp_vitamin_c'],
      },
      high: {
        text: 'Serious side effects are very rare, because the body doesn’t store vitamin C. More than 2,000 mg a day isn’t recommended: doses that high can cause stomach upset and diarrhea and, rarely, kidney stones. Large supplement doses aren’t recommended during pregnancy.',
        sources: ['mlp_vitamin_c'],
      },
    },
  },
  {
    id: 'vitamin_d',
    name: 'Vitamin D',
    category: 'vitamin',
    unit: 'mcg',
    dri: { page: 'vitamins', table: 0, column: 'Vitamin D', unitColumn: 'μg/day', iu: 'IU/day' },
    usda: { ids: [1114], unit: 'UG' },
    openFoodFacts: null,
    about: {
      does: {
        text: 'Helps your body absorb calcium, which you need for normal bone formation.',
        sources: ['mlp_vitamin_d'],
      },
      low: {
        text: 'If your body can’t absorb enough calcium because vitamin D is low, bones can suffer. Deficiency can lead to weakened bones: osteomalacia and osteoporosis in adults, or rickets in children.',
        sources: ['mlp_vitamin_d'],
      },
      high: {
        text: 'Too much can make the intestines absorb too much calcium, raising the calcium in your blood. That can lead to calcium deposits in soft tissues such as the heart and lungs, confusion, kidney damage, kidney stones, nausea, vomiting, constipation, poor appetite, weakness and weight loss.',
        sources: ['mlp_vitamin_d'],
      },
    },
  },
  {
    id: 'vitamin_e',
    ulOnlySupplements: true,
    name: 'Vitamin E',
    category: 'vitamin',
    unit: 'mg',
    basis: 'alpha-tocopherol',
    dri: { page: 'vitamins', table: 0, column: 'Vitamin E' },
    usda: { ids: [1109], unit: 'MG' },
    openFoodFacts: null,
    about: {
      does: {
        text: 'An antioxidant that protects body tissue from damage by free radicals. It also helps keep the immune system strong, helps form red blood cells and widen blood vessels, and helps the body use vitamin K.',
        sources: ['mlp_vitamin_e'],
      },
      low: {
        text: 'Low intake may lead to hemolytic anemia (red blood cells breaking down) in premature babies.',
        sources: ['mlp_vitamin_e'],
      },
      high: {
        text: 'Vitamin E in food isn’t risky or harmful. High doses of vitamin E supplements might increase the risk of bleeding in the brain (hemorrhagic stroke).',
        sources: ['mlp_vitamin_e', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'vitamin_k',
    name: 'Vitamin K',
    category: 'vitamin',
    unit: 'mcg',
    dri: { page: 'vitamins', table: 0, column: 'Vitamin K' },
    usda: { ids: [1185], unit: 'UG' },
    openFoodFacts: { key: 'vitamin-k', zero: false },
    about: {
      does: {
        text: 'Known as the clotting vitamin: your liver needs it to make the proteins that help blood clot. Some studies suggest it helps keep bones strong in older adults.',
        sources: ['mlp_vitamin_k'],
      },
      low: {
        text: 'Deficiency is very rare. It happens when the body can’t absorb the vitamin properly from the gut, and sometimes after long-term antibiotic treatment, and it makes bruising and bleeding more likely.',
        sources: ['mlp_vitamin_k'],
      },
      high: {
        text: 'If you take the blood thinner warfarin, vitamin K from food can change how well it works: it’s important to keep your intake steady from day to day, so ask your health care provider how much is right for you.',
        sources: ['mlp_vitamin_k', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'thiamin',
    name: 'Thiamin',
    altName: 'Vitamin B1',
    category: 'vitamin',
    unit: 'mg',
    dri: { page: 'vitamins', table: 1, column: 'Thiamin' },
    usda: { ids: [1165], unit: 'MG' },
    openFoodFacts: { key: 'vitamin-b1', zero: false },
    about: {
      does: {
        text: 'Helps your cells turn carbohydrates into energy, especially for the brain and nervous system. It also plays a role in muscle contraction and nerve signals.',
        sources: ['mlp_thiamin'],
      },
      low: {
        text: 'A lack can cause weakness, tiredness, confusion and nerve damage, and can lead to a disease called beriberi. Severe deficiency can cause brain damage (Wernicke disease and Korsakoff syndrome). It’s most often seen with heavy alcohol use, which makes thiamin hard to absorb.',
        sources: ['mlp_thiamin'],
      },
      high: {
        text: 'There’s no known poisoning linked to too much thiamin.',
        sources: ['mlp_thiamin', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'riboflavin',
    name: 'Riboflavin',
    altName: 'Vitamin B2',
    category: 'vitamin',
    unit: 'mg',
    dri: { page: 'vitamins', table: 1, column: 'Riboflavin' },
    usda: { ids: [1166], unit: 'MG' },
    openFoodFacts: { key: 'vitamin-b2', zero: false },
    about: {
      does: {
        text: 'Works with the other B vitamins. It’s important for growth, helps make red blood cells, and helps release energy from carbohydrates, proteins and fats.',
        sources: ['mlp_riboflavin'],
      },
      low: {
        text: 'A lack is uncommon, because riboflavin is plentiful in food. A severe deficiency can cause anemia, mouth or lip sores, skin problems, a sore throat and swelling of the mucous membranes.',
        sources: ['mlp_riboflavin'],
      },
      high: {
        text: 'Extra riboflavin leaves the body in urine, and there’s no known poisoning from it.',
        sources: ['mlp_riboflavin', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'niacin',
    ulOnlySupplements: true,
    name: 'Niacin',
    altName: 'Vitamin B3',
    category: 'vitamin',
    unit: 'mg',
    basis: 'NE',
    dri: { page: 'vitamins', table: 1, column: 'Niacin' },
    usda: { ids: [1167], unit: 'MG' },
    openFoodFacts: { key: 'vitamin-pp', zero: false },
    note: 'Food data gives niacin itself. Health Canada’s figure is in niacin equivalents, which also count the niacin your body makes from tryptophan in protein, so your logged amount will read lower than what you actually get.',
    about: {
      does: {
        text: 'Helps your digestive system, skin and nerves work, and is important for turning food into energy.',
        sources: ['mlp_niacin'],
      },
      low: {
        text: 'A deficiency causes pellagra, with digestive problems, inflamed skin and poor mental function.',
        sources: ['mlp_niacin'],
      },
      high: {
        text: 'Too much can raise blood sugar, damage the liver, and cause peptic ulcers and skin rashes. Niacin supplements can cause flushing: warmth, redness, itching or tingling of the face, neck, arms or upper chest.',
        sources: ['mlp_niacin', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'pantothenic_acid',
    name: 'Pantothenic Acid',
    altName: 'Vitamin B5',
    category: 'vitamin',
    unit: 'mg',
    dri: { page: 'vitamins', table: 2, column: 'Pantothenic Acid' },
    usda: { ids: [1170], unit: 'MG' },
    openFoodFacts: { key: 'pantothenic-acid', zero: false },
    about: {
      does: {
        text: 'Needed for growth and to break down and use food (your metabolism). It’s needed to make fatty acids, and plays a role in making hormones and cholesterol.',
        sources: ['mlp_pantothenic_biotin'],
      },
      low: {
        text: 'A lack is very rare, but can cause a tingling feeling in the feet.',
        sources: ['mlp_pantothenic_biotin'],
      },
      high: {
        text: 'Large doses don’t cause symptoms, other than possibly diarrhea.',
        sources: ['mlp_pantothenic_biotin', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'vitamin_b6',
    name: 'Vitamin B6',
    category: 'vitamin',
    unit: 'mg',
    dri: { page: 'vitamins', table: 1, column: 'Vitamin B6' },
    usda: { ids: [1175], unit: 'MG' },
    openFoodFacts: { key: 'vitamin-b6', zero: false },
    about: {
      does: {
        text: 'Helps your body make antibodies to fight infection, keep nerves working normally, make hemoglobin (which carries oxygen in red blood cells), break down protein and keep blood sugar in normal ranges. The more protein you eat, the more vitamin B6 you need.',
        sources: ['mlp_vitamin_b6'],
      },
      low: {
        text: 'A deficiency can cause confusion, depression, irritability, mouth and tongue sores, nerve damage in the hands and feet (peripheral neuropathy) and a form of anemia.',
        sources: ['mlp_vitamin_b6'],
      },
      high: {
        text: 'Large doses can cause trouble coordinating movement, numbness and changes in sensation.',
        sources: ['mlp_vitamin_b6'],
      },
    },
  },
  {
    id: 'biotin',
    name: 'Biotin',
    altName: 'Vitamin B7',
    category: 'vitamin',
    unit: 'mcg',
    dri: { page: 'vitamins', table: 2, column: 'Biotin' },
    usda: { ids: [1176], unit: 'UG' },
    openFoodFacts: { key: 'biotin', zero: false },
    about: {
      does: {
        text: 'Needed for growth and to break down and use food (your metabolism), including making fatty acids.',
        sources: ['mlp_pantothenic_biotin'],
      },
      low: {
        text: 'A lack may lead to muscle pain, skin inflammation (dermatitis) or a swollen tongue. Signs include skin rashes, hair loss and brittle nails.',
        sources: ['mlp_pantothenic_biotin'],
      },
      high: {
        text: 'There are no known toxic symptoms from biotin.',
        sources: ['mlp_pantothenic_biotin', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'folate',
    ulOnlySupplements: true,
    name: 'Folate',
    altName: 'Vitamin B9',
    category: 'vitamin',
    unit: 'mcg',
    basis: 'DFE',
    dri: { page: 'vitamins', table: 2, column: 'Folate' },
    usda: { ids: [1190], unit: 'UG' },
    openFoodFacts: null,
    about: {
      does: {
        text: 'Helps tissues grow and cells work, helps form red blood cells, helps make DNA, and works with vitamin B12 and vitamin C to break down, use and make proteins.',
        sources: ['mlp_folate'],
      },
      low: {
        text: 'A deficiency may cause diarrhea, mouth ulcers, poor growth, a swollen tongue and certain types of anemia. Getting the right amount of folic acid before and during pregnancy helps prevent neural tube defects such as spina bifida.',
        sources: ['mlp_folate'],
      },
      high: {
        text: 'Folic acid doesn’t cause harm at recommended levels: extra leaves the body in urine. Unless your health care provider advises otherwise, avoid taking more than 1,000 mcg of folic acid a day, since higher amounts can hide a vitamin B12 deficiency.',
        sources: ['mlp_folate', 'hc_vitamins'],
      },
    },
  },
  {
    id: 'vitamin_b12',
    name: 'Vitamin B12',
    category: 'vitamin',
    unit: 'mcg',
    dri: { page: 'vitamins', table: 2, column: 'Vitamin B12' },
    usda: { ids: [1178], unit: 'UG' },
    openFoodFacts: { key: 'vitamin-b12', zero: false },
    about: {
      does: {
        text: 'Important for using protein, and helps form red blood cells and maintain the nervous system.',
        sources: ['mlp_vitamin_b12'],
      },
      low: {
        text: 'Low levels can cause anemia, loss of balance, numbness or tingling in the arms and legs, weakness and dementia. A deficiency is most common in people over 50, people on a vegetarian or vegan diet, and people who’ve had stomach or intestinal surgery or have certain digestive conditions.',
        sources: ['mlp_vitamin_b12'],
      },
      // No readable source describes too much B12; Health Canada's note on its upper limit shows.
      high: null,
    },
  },
  {
    id: 'calcium',
    name: 'Calcium',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 0, column: 'Calcium' },
    usda: { ids: [1087], unit: 'MG' },
    openFoodFacts: { key: 'calcium', zero: true },
    about: {
      does: {
        text: 'Helps build and maintain strong bones and teeth. It’s also needed for blood clotting, sending nerve signals, squeezing and relaxing muscles, releasing hormones and keeping a normal heartbeat.',
        sources: ['mlp_calcium'],
      },
      low: {
        text: 'Not getting enough over a long time can lead to osteoporosis: thinning bone tissue and loss of bone density.',
        sources: ['mlp_calcium'],
      },
      high: {
        text: 'More calcium for a short time doesn’t normally cause side effects, but higher amounts over a long time raise the risk of kidney stones in some people.',
        sources: ['mlp_calcium'],
      },
    },
  },
  {
    id: 'iron',
    name: 'Iron',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 1, column: 'Iron' },
    usda: { ids: [1089], unit: 'MG' },
    openFoodFacts: { key: 'iron', zero: true },
    about: {
      does: {
        text: 'Your body needs iron to make hemoglobin, which carries oxygen in red blood cells, and myoglobin, found in muscles.',
        sources: ['mlp_iron'],
      },
      low: {
        text: 'A low iron level over a long time can lead to iron deficiency anemia, with low energy, shortness of breath, headaches, irritability, dizziness or weight loss. People more at risk include those with menstrual periods (especially heavy ones), those who are pregnant or have just had a baby, long-distance runners and frequent blood donors.',
        sources: ['mlp_iron'],
      },
      high: {
        text: 'Taking in too much iron is unlikely, but children can be poisoned by swallowing iron supplements. Hemochromatosis, a genetic disorder, makes the body absorb too much iron.',
        sources: ['mlp_iron'],
      },
    },
  },
  {
    id: 'magnesium',
    ulOnlySupplements: true,
    name: 'Magnesium',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 1, column: 'Magnesium' },
    usda: { ids: [1090], unit: 'MG' },
    openFoodFacts: { key: 'magnesium', zero: false },
    about: {
      does: {
        text: 'Needed for more than 300 reactions in the body. It helps nerves and muscles work, supports the immune system, keeps the heartbeat steady, helps keep bones strong, helps adjust blood sugar, and helps make energy and protein.',
        sources: ['mlp_magnesium'],
      },
      low: {
        text: 'A true lack is rare. Early signs include loss of appetite, nausea, vomiting, tiredness and weakness; a more severe deficiency can cause numbness or tingling, muscle cramps, seizures and abnormal heart rhythms.',
        sources: ['mlp_magnesium'],
      },
      high: {
        text: 'Side effects from high intake are uncommon except in people with significantly reduced kidney function, because the body generally removes the extra. Too much most often comes from supplements or laxatives that contain magnesium.',
        sources: ['mlp_magnesium', 'hc_elements'],
      },
    },
  },
  {
    id: 'zinc',
    name: 'Zinc',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 2, column: 'Zinc' },
    usda: { ids: [1095], unit: 'MG' },
    openFoodFacts: { key: 'zinc', zero: false },
    about: {
      does: {
        text: 'Needed for your immune system to work properly, and plays a role in cell growth and division, wound healing and breaking down carbohydrates. It’s also needed for smell and taste, and for growing and developing properly in pregnancy, infancy and childhood.',
        sources: ['mlp_zinc'],
      },
      low: {
        text: 'Signs of a deficiency include frequent infections, hair loss, poor appetite, problems with taste and smell, skin sores, slow growth, trouble seeing in the dark and wounds that heal slowly.',
        sources: ['mlp_zinc'],
      },
      high: {
        text: 'Large amounts of zinc supplements may cause diarrhea, abdominal cramps and vomiting. Too much zinc over a long time can lead to a lack of copper, iron or magnesium.',
        sources: ['mlp_zinc'],
      },
    },
  },
  {
    id: 'potassium',
    name: 'Potassium',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 2, column: 'Potassium' },
    usda: { ids: [1092], unit: 'MG' },
    openFoodFacts: { key: 'potassium', zero: true },
    about: {
      does: {
        text: 'Supports heart health and proper muscle function, helps maintain bone health and the body’s acid-base balance, and helps break down and use carbohydrates.',
        sources: ['mlp_potassium'],
      },
      low: {
        text: 'A low blood level of potassium (hypokalemia) can cause weak muscles, abnormal heart rhythms and a slight rise in blood pressure. It’s usually linked to diuretics, too many laxatives, severe vomiting or diarrhea, or certain kidney or adrenal disorders.',
        sources: ['mlp_potassium'],
      },
      high: {
        text: 'Too much potassium in the blood (hyperkalemia) may cause dangerous heart rhythms. Common causes include poor kidney function and some heart and blood pressure medicines.',
        sources: ['mlp_potassium', 'hc_elements'],
      },
    },
  },
  {
    id: 'sodium',
    name: 'Sodium',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 2, column: 'Sodium' },
    usda: { ids: [1093], unit: 'MG' },
    openFoodFacts: { key: 'sodium', zero: true },
    about: {
      does: {
        text: 'Your body uses sodium to control blood pressure and blood volume, and needs it for your muscles and nerves to work properly.',
        sources: ['mlp_sodium'],
      },
      low: null,
      high: {
        text: 'Too much sodium may lead to high blood pressure in some people, and to a serious buildup of fluid in people with heart failure, cirrhosis of the liver or kidney disease.',
        sources: ['mlp_sodium', 'hc_elements'],
      },
    },
  },
  {
    id: 'phosphorus',
    name: 'Phosphorus',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 1, column: 'Phosphorus' },
    usda: { ids: [1091], unit: 'MG' },
    openFoodFacts: { key: 'phosphorus', zero: false },
    about: {
      does: {
        text: 'Mainly builds bones and teeth. It’s also needed to use carbohydrates and fats, to make the protein that grows and repairs cells, and to make ATP, which the body uses to store energy. It also helps the kidneys, muscles, heartbeat and nerve signals.',
        sources: ['mlp_phosphorus'],
      },
      low: {
        text: 'Phosphorus is so common in food that a deficiency is rare.',
        sources: ['mlp_phosphorus'],
      },
      high: {
        text: 'High levels of phosphorus in the blood are rare and only occur with severe kidney disease or a severe problem controlling calcium. They can combine with calcium to form deposits in soft tissues such as muscle.',
        sources: ['mlp_phosphorus'],
      },
    },
  },
  {
    id: 'selenium',
    name: 'Selenium',
    category: 'mineral',
    unit: 'mcg',
    dri: { page: 'elements', table: 2, column: 'Selenium' },
    usda: { ids: [1103], unit: 'UG' },
    openFoodFacts: { key: 'selenium', zero: false },
    about: {
      does: {
        text: 'A trace element your body needs only in small amounts. It helps make antioxidant enzymes, which help prevent cell damage.',
        sources: ['mlp_selenium'],
      },
      low: {
        text: 'A lack is rare, but can happen in people fed through an IV for a long time or with severe digestive disorders. A lack of selenium causes Keshan disease, a heart muscle disorder, and has been linked to Kashin-Beck disease, a joint and bone disease.',
        sources: ['mlp_selenium'],
      },
      high: {
        text: 'Too much selenium in the blood causes selenosis: hair loss, nail problems, nausea, irritability, tiredness and mild nerve damage.',
        sources: ['mlp_selenium'],
      },
    },
  },
  {
    id: 'copper',
    name: 'Copper',
    category: 'mineral',
    unit: 'mcg',
    dri: { page: 'elements', table: 0, column: 'Copper' },
    usda: { ids: [1098], unit: 'MG' },
    openFoodFacts: { key: 'copper', zero: false },
    about: {
      does: {
        text: 'Works with iron to help the body form red blood cells, helps absorb iron, and helps keep blood vessels, nerves, the immune system and bones healthy.',
        sources: ['mlp_copper'],
      },
      low: {
        text: 'Most people get enough from the food they eat. A lack may lead to anemia and osteoporosis.',
        sources: ['mlp_copper'],
      },
      high: {
        text: 'In large amounts, copper is poisonous. Wilson disease, a rare inherited disorder, causes copper to build up in the liver, brain and other organs.',
        sources: ['mlp_copper'],
      },
    },
  },
  {
    id: 'manganese',
    name: 'Manganese',
    category: 'mineral',
    unit: 'mg',
    dri: { page: 'elements', table: 1, column: 'Manganese' },
    usda: { ids: [1101], unit: 'MG' },
    openFoodFacts: { key: 'manganese', zero: false },
    // No plain-language source on manganese could be read (MedlinePlus has no article on it; the
    // NIH and National Academies pages refused automated reading), so nothing is said.
    about: { does: null, low: null, high: null },
  },
  {
    id: 'iodine',
    name: 'Iodine',
    category: 'mineral',
    unit: 'mcg',
    dri: { page: 'elements', table: 0, column: 'Iodine' },
    usda: { ids: [1100], unit: 'UG' },
    openFoodFacts: { key: 'iodine', zero: false },
    about: {
      does: {
        text: 'Needed for your thyroid to work normally and make thyroid hormones, and for your cells to turn food into energy.',
        sources: ['mlp_iodine'],
      },
      low: {
        text: 'Many months of too little iodine can cause goiter (an enlarged thyroid) or hypothyroidism. It’s more likely where the soil is low in iodine, and getting enough helps prevent cretinism, a serious disorder of growth and development.',
        sources: ['mlp_iodine'],
      },
      high: {
        text: 'Very high intake can reduce how well the thyroid works, and high doses taken with anti-thyroid medicines can cause hypothyroidism.',
        sources: ['mlp_iodine'],
      },
    },
  },
  {
    id: 'chromium',
    name: 'Chromium',
    category: 'mineral',
    unit: 'mcg',
    dri: { page: 'elements', table: 0, column: 'Chromium' },
    usda: { ids: [1096], unit: 'UG' },
    openFoodFacts: { key: 'chromium', zero: false },
    about: {
      does: {
        text: 'Important for breaking down fats and carbohydrates, and helps insulin work and the body break down glucose.',
        sources: ['mlp_chromium'],
      },
      low: {
        text: 'A lack may be seen in people with impaired glucose tolerance.',
        sources: ['mlp_chromium'],
      },
      high: {
        text: 'Because little chromium is absorbed and much is passed out of the body, toxicity isn’t common.',
        sources: ['mlp_chromium', 'hc_elements'],
      },
    },
  },
  {
    id: 'fibre',
    name: 'Dietary Fibre',
    category: 'other',
    unit: 'g',
    dri: { page: 'macronutrients', table: 1, column: 'Total Fibre' },
    usda: { ids: [1079, 2033], unit: 'G' },
    openFoodFacts: { key: 'fiber', zero: true },
    about: {
      does: {
        text: 'Adds bulk to your diet and helps you feel full sooner, aids digestion and helps prevent constipation.',
        sources: ['mlp_fibre'],
      },
      low: {
        text: 'A diet low in fibre has been linked to higher rates of irritable bowel syndrome, diabetes, obesity, cardiovascular disease and colon cancer.',
        sources: ['mlp_fibre'],
      },
      high: {
        text: 'A lot of fibre in a short time can cause gas, bloating and cramps, which usually settle as your gut gets used to it, so it helps to add fibre slowly. Too much may get in the way of absorbing minerals such as iron, zinc, magnesium and calcium, though high-fibre foods tend to be rich in minerals.',
        sources: ['mlp_fibre'],
      },
    },
  },
  {
    id: 'saturated_fat',
    name: 'Saturated Fat',
    category: 'other',
    unit: 'g',
    dri: null,
    guidance: { page: 'macronutrients', name: 'Saturated fatty acids' },
    usda: { ids: [1258], unit: 'G' },
    openFoodFacts: { key: 'saturated-fat', zero: true },
    about: {
      does: {
        text: 'A type of fat in food. Fats give your body energy and help it absorb vitamins A, D, E and K.',
        sources: ['mlp_fats_explained'],
      },
      low: null,
      high: {
        text: 'Saturated fat raises LDL (“bad”) cholesterol, and high LDL cholesterol increases your risk of heart disease and stroke.',
        sources: ['mlp_saturated_fat'],
      },
    },
  },
  {
    id: 'trans_fat',
    name: 'Trans Fat',
    category: 'other',
    unit: 'g',
    dri: null,
    guidance: { page: 'macronutrients', name: 'Trans fatty acids' },
    usda: { ids: [1257], unit: 'G' },
    openFoodFacts: { key: 'trans-fat', zero: true },
    about: {
      does: {
        text: 'Your body doesn’t need or benefit from trans fats.',
        sources: ['mlp_trans_fat'],
      },
      low: null,
      high: {
        text: 'Trans fats raise LDL (“bad”) cholesterol and lower HDL (“good”) cholesterol, which can cause cholesterol to build up in your arteries and raise your risk of heart disease and stroke.',
        sources: ['mlp_trans_fat'],
      },
    },
  },
  {
    id: 'cholesterol',
    name: 'Cholesterol',
    category: 'other',
    unit: 'mg',
    dri: null,
    guidance: { page: 'macronutrients', name: 'Dietary cholesterol' },
    usda: { ids: [1253], unit: 'MG' },
    openFoodFacts: { key: 'cholesterol', zero: true },
    // The plain-language sources that could be read are about blood cholesterol, not cholesterol
    // in food, so nothing is said beyond Health Canada's guidance.
    about: { does: null, low: null, high: null },
  },
];
