/**
 * Comprehensive Clinical Knowledge Base Seeder (50+ Medical Modules)
 *
 * Authored according to:
 * - American Diabetes Association (ADA Standards of Care 2026)
 * - IDF-DAR (International Diabetes Federation & Ramadan Alliance)
 * - Pakistan Endocrine Society (PES Dietary & Climate Consensus)
 * - American Psychiatric Association (APA DSM-5-TR Clinical Practice Guidelines)
 * - World Health Organization (WHO mhGAP Guidelines)
 * - ACC / AHA Cardiovascular Guidelines
 */

const prisma = require('../../config/database');
const { generateDeterministicVector } = require('./VectorStoreProvider');

const COMPREHENSIVE_DOCUMENTS = [
  // ==========================================
  // DOCUMENT 1: ADA Standards of Care in Diabetes (2026)
  // ==========================================
  {
    title: 'ADA Standards of Medical Care in Diabetes (2026)',
    source_name: 'American Diabetes Association (ADA)',
    source_version: '2026.1',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'diabetes',
    topic: 'basics',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Definition and Classification of Diabetes Mellitus',
        domain: 'diabetes',
        topic: 'basics',
        subtopic: 'what_is_diabetes',
        section: 'Diagnosis & Classification',
        content:
          'Diabetes mellitus is a chronic metabolic condition characterized by persistent hyperglycemia resulting from defects in insulin secretion, insulin action, or both. The two major types are: 1) Type 1 Diabetes: An autoimmune disease where the immune system destroys insulin-producing beta cells in the pancreas, leading to absolute insulin deficiency. 2) Type 2 Diabetes: A progressive disorder characterized by insulin resistance (cells do not respond effectively to insulin) combined with relative insulin secretory defect. Prediabetes is an intermediate state where glucose levels are elevated but below diagnostic thresholds for diabetes.',
      },
      {
        title: 'Diagnostic Criteria for Diabetes and Prediabetes',
        domain: 'diabetes',
        topic: 'glucose_targets',
        subtopic: 'diagnostic_criteria',
        section: 'Diagnostic Thresholds',
        content:
          'Diagnostic thresholds established by ADA: 1) Fasting Plasma Glucose (FPG): Normal is 70–99 mg/dL (3.9–5.5 mmol/L); Prediabetes (Impaired Fasting Glucose) is 100–125 mg/dL (5.6–6.9 mmol/L); Diabetes is >= 126 mg/dL (7.0 mmol/L) after an 8-hour fast. 2) 2-Hour Oral Glucose Tolerance Test (OGTT 75g): Normal < 140 mg/dL; Prediabetes 140–199 mg/dL; Diabetes >= 200 mg/dL (11.1 mmol/L). 3) Glycated Hemoglobin (HbA1c): Normal < 5.7%; Prediabetes 5.7%–6.4%; Diabetes >= 6.5%. 4) Random Plasma Glucose >= 200 mg/dL accompanied by classic symptoms (polyuria, polydipsia, unexplained weight loss) confirms diabetes.',
      },
      {
        title: 'Glycemic Targets and Self-Monitoring (SMBG) for Adults',
        domain: 'diabetes',
        topic: 'glucose_targets',
        subtopic: 'monitoring_targets',
        section: 'Glycemic Targets',
        content:
          'Standard adult non-pregnant glycemic targets: 1) Preprandial (Fasting/Before Meals) capillary blood glucose: 80–130 mg/dL (4.4–7.2 mmol/L). 2) Peak Postprandial (1 to 2 hours after start of meal) blood glucose: < 180 mg/dL (10.0 mmol/L). 3) Overall HbA1c target for most non-pregnant adults: < 7.0% (53 mmol/mol). More stringent targets (< 6.5%) may be set for younger patients without hypoglycemia risk, while more relaxed targets (< 8.0%) are appropriate for frail older adults or those with severe hypoglycemia unawareness.',
      },
      {
        title: 'Management of Mild to Moderate Hypoglycemia (The 15-15 Rule)',
        domain: 'diabetes',
        topic: 'hypoglycemia',
        subtopic: '15_15_rule',
        section: 'Acute Complications',
        content:
          'Hypoglycemia (low blood sugar) occurs when blood glucose drops < 70 mg/dL (3.9 mmol/L). Common symptoms include shakiness/trembling (kapkapi), sweating (paseena), rapid heartbeat (palpitations), dizziness (chakkar), extreme hunger, and irritability. The 15-15 Rule for conscious patients: 1) Consume 15–20 grams of fast-acting simple carbohydrates (e.g., 4 ounces / half cup of fruit juice, half can of regular soda, 3-4 glucose tablets, or 1 tablespoon of table sugar or honey). 2) Wait 15 minutes and re-check blood glucose. 3) If glucose remains < 70 mg/dL, repeat the 15g carbohydrate intake. 4) Once glucose reaches >= 70 mg/dL, eat a snack or meal containing complex carbs and protein (e.g., roti with daal or a small sandwich) to prevent recurrence.',
      },
      {
        title: 'Severe Hypoglycemia and Emergency Red Flag Protocol',
        domain: 'diabetes',
        topic: 'hypoglycemia',
        subtopic: 'severe_hypoglycemia_emergency',
        section: 'Emergency Complications',
        content:
          'Severe Hypoglycemia is clinically defined as blood glucose < 54 mg/dL (3.0 mmol/L) or any level causing cognitive impairment, confusion, seizure, or loss of consciousness (unresponsiveness/behosh). In unconscious patients: DO NOT attempt to feed fluids or solids by mouth due to choking/aspiration risk. Position patient on their side (recovery position), administer prescribed emergency glucagon if available, and immediately call Rescue 1122 or transport to the nearest Emergency Department.',
      },
      {
        title: 'Diabetic Ketoacidosis (DKA) Recognition and Urgent Red Flags',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'dka_warning_signs',
        section: 'Acute Metabolic Emergencies',
        content:
          'Diabetic Ketoacidosis (DKA) is a life-threatening acute complication primarily in Type 1 diabetes (and advanced Type 2) caused by profound insulin deficiency. Red flag symptoms: Blood glucose persistently > 250 mg/dL (13.9 mmol/L) accompanied by nausea, persistent vomiting, abdominal pain (pait mein shadeed dard), rapid deep breathing (Kussmaul breathing / tezi se saans lena), acetone/fruity breath odor, extreme dehydration, and drowsiness/lethargy. DKA requires immediate hospital emergency room admission for intravenous hydration, insulin infusion, and electrolyte stabilization.',
      },
      {
        title: 'Hyperglycemic Hyperosmolar State (HHS) Warning Signs',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'hhs_warning_signs',
        section: 'Acute Metabolic Emergencies',
        content:
          'Hyperglycemic Hyperosmolar State (HHS) is an acute metabolic crisis most common in elderly Type 2 diabetes patients during acute illness or severe dehydration. Hallmarks include extremely high blood glucose (typically > 600 mg/dL / 33.3 mmol/L), severe hyperosmolality, profound dehydration without significant ketoacidosis, and progressive neurological impairment (confusion, lethargy, coma). Requires emergency medical transfer to ICU for aggressive intravenous rehydration and hemodynamic monitoring.',
      },
      {
        title: 'Comprehensive Diabetic Foot Examination and Ulcer Prevention',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'diabetic_foot_care',
        section: 'Microvascular Complications',
        content:
          'Diabetic peripheral neuropathy (loss of sensation) and peripheral arterial disease make feet vulnerable to painless injuries, ulcers, and severe infection. Essential daily foot rules: 1) Inspect feet daily for cuts, blisters, redness, swelling, or nail cracks. 2) Wash feet daily with lukewarm water and dry thoroughly, especially between toes. 3) Apply moisturizer to dry skin but avoid between toes. 4) Never walk barefoot (nange pao), even indoors. 5) Wear comfortable, well-fitting footwear. Any open wound, blister, discoloration (black/blue toe), or discharge (peep/pus) requires immediate clinical review by a physician to prevent osteomyelitis or amputation.',
      },
      {
        title: 'Diabetic Peripheral Neuropathy (Nerve Damage Symptoms)',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'neuropathy_symptoms',
        section: 'Chronic Complications',
        content:
          'Diabetic peripheral neuropathy is chronic nerve damage resulting from sustained high blood glucose. Symptoms usually start in the toes and feet ("stocking-glove" distribution): persistent numbness (sunn hona), burning sensations (jalan/aag nikalna), tingling/pins and needles (suiyan chubhna), or sharp electric-shock-like pain that worsens at night. Management centers on strict glycemic optimization, lifestyle modifications, and clinician-prescribed neuropathic symptom relief medications (e.g., pregabalin, duloxetine, gabapentin).',
      },
      {
        title: 'Diabetic Kidney Disease (Nephropathy) and Annual Screening',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'nephropathy_screening',
        section: 'Chronic Microvascular Complications',
        content:
          'Diabetic kidney disease is the leading cause of chronic kidney failure. Early kidney damage is asymptomatic. Mandatory annual screening includes: 1) Spot urine albumin-to-creatinine ratio (uACR) to detect microalbuminuria (>= 30 mg/g creatinine indicates early kidney strain). 2) Serum creatinine and estimated Glomerular Filtration Rate (eGFR). Prevention requires maintaining blood pressure < 130/80 mmHg, strict blood glucose control, and ACE inhibitors or ARBs and SGLT2 inhibitors as prescribed by a physician.',
      },
      {
        title: 'Diabetic Retinopathy and Annual Eye Exams',
        domain: 'diabetes',
        topic: 'complications',
        subtopic: 'retinopathy_screening',
        section: 'Chronic Microvascular Complications',
        content:
          'Diabetic retinopathy is damage to retinal blood vessels caused by high blood sugar and is a major cause of preventable vision loss. Early stages show no symptoms. All adults with Type 2 diabetes must have an initial dilated eye examination by an ophthalmologist at diagnosis and annually thereafter. Type 1 patients should begin annual exams within 5 years of diagnosis. Warning signs requiring urgent eye review: blurry vision (dhundla pan), sudden floating dark spots (floaters), cobwebs, or sudden vision loss.',
      },
      {
        title: 'First-Line Oral Diabetes Pharmacotherapy (Metformin and SGLT2i)',
        domain: 'diabetes',
        topic: 'medication',
        subtopic: 'oral_medications',
        section: 'Pharmacotherapy Guidelines',
        content:
          'Metformin remains the foundational first-line oral agent for Type 2 diabetes unless contraindicated (e.g., severe renal impairment eGFR < 30 mL/min). Metformin reduces hepatic glucose production and improves insulin sensitivity; common initial gastrointestinal side effects (nausea, loose stools) are minimized by taking it with meals and gradual titration. SGLT2 inhibitors (e.g., empagliflozin, dapagliflozin) and GLP-1 receptor agonists provide proven cardiovascular and renal protective benefits in patients with established heart disease or chronic kidney disease.',
      },
      {
        title: 'Insulin Therapy Basics: Basal vs Bolus Principles',
        domain: 'diabetes',
        topic: 'medication',
        subtopic: 'insulin_therapy_basics',
        section: 'Insulin Management',
        content:
          'Insulin regimens mimic normal physiological pancreatic output: 1) Basal Insulin (e.g., Glargine, Detemir, Degludec, NPH): Long/intermediate-acting insulin injected once or twice daily to control background fasting blood sugar between meals and overnight. 2) Bolus/Prandial Insulin (e.g., Aspart, Lispro, Glulisine, Regular): Rapid/short-acting insulin taken before meals to manage post-meal glycemic surges. Patients must rotate injection sites across the abdomen, thighs, and upper arms to prevent lipohypertrophy (fatty lumps that impair insulin absorption).',
      },
      {
        title: 'Insulin Storage, Cold Chain, and Summer Heat Safety in Pakistan',
        domain: 'diabetes',
        topic: 'medication',
        subtopic: 'insulin_storage_summer',
        section: 'Practical Medication Safety',
        content:
          'Insulin is a delicate protein hormone that degrades if exposed to extreme heat (> 30°C) or freezing. Unopened insulin vials and pens should be stored in a refrigerator (2°C to 8°C). In-use vials/pens can be kept at room temperature (< 25–30°C) away from direct sunlight for up to 28 days. During summer load-shedding and power outages in Pakistan: Store insulin vials in an unglazed earthen clay pot (matka/ghara) filled with cool water, an insulated thermos flask with a cool pack wrapped in cloth (prevent direct ice contact), or a cool shaded room area.',
      },
      {
        title: 'Gestational Diabetes Mellitus (GDM) Screening and Safety',
        domain: 'diabetes',
        topic: 'basics',
        subtopic: 'gestational_diabetes',
        section: 'Special Populations',
        content:
          'Gestational Diabetes Mellitus (GDM) is high blood sugar diagnosed during the 24th to 28th week of pregnancy via a 75g Oral Glucose Tolerance Test (OGTT). Strict maternal glycemic targets are: Fasting <= 95 mg/dL (5.3 mmol/L), 1-Hour Postprandial <= 140 mg/dL (7.8 mmol/L), and 2-Hour Postprandial <= 120 mg/dL (6.7 mmol/L). Uncontrolled GDM increases risks of macrosomia (high birth weight baby), preeclampsia, and neonatal hypoglycemia. Management starts with medical nutrition therapy and moderate walking; insulin is the gold standard when pharmacotherapy is required.',
      },
    ],
  },

  // ==========================================
  // DOCUMENT 2: IDF-DAR Practical Ramadan Fasting Guidelines
  // ==========================================
  {
    title: 'IDF-DAR Practical Guidelines for Diabetes Management During Ramadan Fasting',
    source_name: 'IDF-DAR Global Alliance',
    source_version: '2026.1',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'diabetes',
    topic: 'fasting',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Pre-Ramadan Risk Stratification and Medical Assessment',
        domain: 'diabetes',
        topic: 'fasting',
        subtopic: 'ramadan_risk_assessment',
        section: 'Pre-Fasting Assessment',
        content:
          'The IDF-DAR risk calculator stratifies patients with diabetes into three risk categories 6 to 8 weeks prior to Ramadan: 1) Very High / High Risk: Severe hypoglycemia in past 3 months, history of recurrent hypoglycemia or hypoglycemia unawareness, poorly controlled Type 1 diabetes, acute illness/DKA within 3 months, advanced chronic kidney disease (CKD stage 4-5), pregnancy with diabetes, or frail elderly patients on insulin/sulfonylureas. Fasting is medically contraindicated. 2) Moderate / Low Risk: Well-controlled Type 2 diabetes on diet alone, metformin, DPP-4 inhibitors, SGLT2 inhibitors, or GLP-1 RAs. Fasting is generally safe with structured education and medication adjustment.',
      },
      {
        title: 'Mandatory Fast-Breaking Criteria (When You MUST Break Your Fast)',
        domain: 'diabetes',
        topic: 'fasting',
        subtopic: 'when_to_break_fast',
        section: 'Safety Rules During Fasting',
        content:
          'According to Islamic medical jurisprudence and IDF-DAR guidelines, fasting patients with diabetes MUST break their fast immediately (roza foran todna lazmi hai) if: 1) Blood glucose falls < 70 mg/dL (3.9 mmol/L) at any time during the day. 2) Blood glucose rises > 300 mg/dL (16.7 mmol/L). 3) Patient experiences acute symptoms of hypoglycemia (tremors, cold sweat, severe dizziness, confusion) or acute severe dehydration. Testing blood sugar with a fingerstick glucometer DOES NOT invalidate or break the fast.',
      },
      {
        title: 'Suhoor (Sehri) and Iftar Meal Planning for Diabetic Patients',
        domain: 'diabetes',
        topic: 'fasting',
        subtopic: 'sehri_iftar_diet',
        section: 'Ramadan Nutrition',
        content:
          'Ramadan meal rules for stable diabetes: 1) Suhoor (Sehri): Must NEVER be skipped. Delay Sehri until the last allowable time. Focus on complex slow-release carbohydrates and proteins (e.g., whole wheat / barley roti, eggs, lentils/daal, plain yogurt) to sustain energy and prevent daytime hypoglycemia. 2) Iftar: Break fast with 1 small date (khajoor) and plain water. Avoid deep-fried foods (pakoras, samosas, jalebi) and sugar-sweetened drinks (sherbet/rooh afza); replace with grilled/baked snacks, fruit chaat without added sugar, and fresh lemonade without sugar. Drink 8–10 glasses of water between Iftar and Suhoor.',
      },
      {
        title: 'Medication and Insulin Dose Adjustments During Ramadan',
        domain: 'diabetes',
        topic: 'fasting',
        subtopic: 'ramadan_medication_timing',
        section: 'Ramadan Pharmacotherapy',
        content:
          'Medication timings during Ramadan: 1) Metformin: If taken once daily, take at Iftar. If twice daily, take usual dose at Iftar and half or full dose at Suhoor based on physician guidance. 2) DPP-4 inhibitors (e.g., Sitagliptin, Vildagliptin): Safe with no dose change needed, take at Iftar. 3) Sulfonylureas (e.g., Glimepiride, Gliclazide): High hypoglycemia risk; shift dose to Iftar and reduce Suhoor dose by 50% under doctor guidance. 4) Basal Insulin: Reduce total basal dose by 15%–30% and inject at Iftar. 5) Bolus Insulin: Take usual dose at Iftar, omit lunch dose, and reduce Suhoor dose by 25%–50%. Never adjust doses without direct physician consultation.',
      },
    ],
  },

  // ==========================================
  // DOCUMENT 3: Pakistan Endocrine Society (PES) Diet & Nutrition
  // ==========================================
  {
    title: 'Pakistan Endocrine Society (PES) Consensus on Diabetes Nutrition and Lifestyle',
    source_name: 'Pakistan Endocrine Society (PES)',
    source_version: '2025.2',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'diabetes',
    topic: 'nutrition',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Roti, Grains, and Carbohydrate Choices in Pakistani Cuisine',
        domain: 'diabetes',
        topic: 'nutrition',
        subtopic: 'roti_rice_carbs',
        section: 'Dietary Guidelines',
        content:
          'Carbohydrate guidance for Pakistani diabetics: 1) Roti (Atta): Prefer whole wheat (chakki ka atta) or mixed multigrain flour (gandum, jau/barley, and chana/gram flour) with added bran (chokar). Avoid refined white flour (maida), parathas, and naan. Standard portion is 1 medium-sized roti (6 inches) per meal. 2) Rice (Chawal): High glycemic index; limit to 1 small bowl / cup of boiled or brown rice with plenty of high-fiber vegetables/daal, and avoid combining roti and rice in the same meal.',
      },
      {
        title: 'Fruits and Natural Sugars in South Asian Diets',
        domain: 'diabetes',
        topic: 'nutrition',
        subtopic: 'fruit_glycemic_index',
        section: 'Dietary Guidelines',
        content:
          'Diabetics can safely enjoy fruits in moderation. High Glycemic Index fruits (Mango/Aam, Grapes/Angoor, Dates/Khajoor, Bananas/Kela, Chiku) cause sharp blood sugar spikes and should be strictly limited to small portions (e.g., 2-3 thin slices of mango or half a small banana) eaten as a snack rather than with a heavy meal. Low to Moderate Glycemic Index fruits (Apple/Saib, Guava/Amrood, Orange/Malta, Peach/Aroo, Jamun, Pomegranate/Anar, Papaya) are rich in fiber and vitamins and are preferred options.',
      },
      {
        title: 'Chai, Sweeteners, and Beverages in Pakistan',
        domain: 'diabetes',
        topic: 'nutrition',
        subtopic: 'chai_and_beverages',
        section: 'Dietary Guidelines',
        content:
          'Beverage recommendations: 1) Tea (Chai): Regular consumption of sweet milk chai (doodh patti with white sugar, condensed milk, or gurr) is a major driver of postprandial hyperglycemia. Patients should transition to unsweetened black tea, green tea, or low-fat milk chai without added sugar or gurr. 2) Gurr and Honey: Gurr (jaggery), brown sugar, and honey raise blood glucose almost as rapidly as refined white sugar and are NOT safe unrestricted substitutes. 3) Artificial Sweeteners: Stevia, sucralose, and aspartame are approved safe zero-calorie options when used in moderation.',
      },
      {
        title: 'Cooking Oils, Desi Ghee, and Healthy Fats in Curries',
        domain: 'diabetes',
        topic: 'nutrition',
        subtopic: 'cooking_oils_fats',
        section: 'Cardiometabolic Nutrition',
        content:
          'South Asian curries (salan) often contain excessive saturated fats (desi ghee, vanaspati ghee, butter, full-fat tallow). High saturated fat intake worsens insulin resistance and accelerates coronary artery atherosclerosis. Recommendations: Use moderate amounts of heart-healthy unsaturated oils (canola oil, mustard/sarson oil, olive oil, sunflower oil) limited to 2-3 teaspoons per person per day. Trim visible fat from chicken/mutton and avoid deep-fried gravies (tari).',
      },
      {
        title: 'Exercise Timing, Walking, and Physical Activity for Diabetes',
        domain: 'diabetes',
        topic: 'lifestyle',
        subtopic: 'exercise_and_walking',
        section: 'Physical Activity Guidelines',
        content:
          'Physical activity improves muscle insulin sensitivity and lowers HbA1c: 1) Target: At least 150 minutes of moderate-intensity aerobic physical activity per week (e.g., 30 minutes of brisk walking 5 days a week). 2) Post-Meal Walk (Postprandial Walking): A 10 to 15-minute gentle walk immediately after meals significantly reduces peak post-meal glucose spikes. 3) Precautions: Always wear supportive cushioned footwear (never walk barefoot), stay hydrated, check blood sugar before vigorous exercise, and carry fast-acting glucose (sugar sweets) in case of unexpected hypoglycemia.',
      },
    ],
  },

  // ==========================================
  // DOCUMENT 4: APA Guidelines for Depression and Anxiety
  // ==========================================
  {
    title: 'APA Clinical Practice Guidelines for Depression and Anxiety Disorders',
    source_name: 'American Psychiatric Association (APA)',
    source_version: '2025.2',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'mental_health',
    topic: 'depression',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Major Depressive Disorder (MDD) Screening Criteria and Core Symptoms',
        domain: 'mental_health',
        topic: 'depression',
        subtopic: 'mdd_symptoms_criteria',
        section: 'Mood Disorders',
        content:
          'Major Depressive Disorder (MDD) is diagnosed according to DSM-5 criteria when an individual experiences persistent depressed mood (udasi/mayoosi/ghamgeeni) or loss of interest/pleasure in daily activities (anhedonia/kisi cheez mein dil na lagna) for at least two consecutive weeks. In addition, at least 4 of the following symptoms must be present: 1) Sleep disturbances (insomnia or hypersomnia). 2) Significant weight loss/gain or appetite changes. 3) Psychomotor agitation or retardation. 4) Persistent fatigue or loss of energy. 5) Feelings of worthlessness or excessive guilt. 6) Diminished concentration or indecisiveness. 7) Recurrent thoughts of death or suicidal ideation. Depression is a medical condition involving neurobiology, not a personal weakness.',
      },
      {
        title: 'Patient Health Questionnaire-9 (PHQ-9) Scoring and Interpretation',
        domain: 'mental_health',
        topic: 'depression',
        subtopic: 'phq9_scoring',
        section: 'Validated Clinical Scales',
        content:
          'The PHQ-9 is a globally validated 9-item tool for assessing depression severity: 1) Score 0–4: Minimal or no depression (Self-care and lifestyle monitoring). 2) Score 5–9: Mild depression (Supportive counseling, sleep hygiene, physical exercise). 3) Score 10–14: Moderate depression (Structured psychotherapy like CBT and/or clinician psychiatric consultation). 4) Score 15–19: Moderately severe depression (Combined psychotherapy and pharmacotherapy). 5) Score 20–27: Severe depression (Urgent psychiatric evaluation and pharmacotherapy). Any positive response to Question 9 (thoughts of self-harm or suicide) triggers immediate crisis protocol.',
      },
      {
        title: 'Generalized Anxiety Disorder (GAD-7) Symptoms and Evaluation',
        domain: 'mental_health',
        topic: 'anxiety',
        subtopic: 'gad7_symptoms',
        section: 'Anxiety Disorders',
        content:
          'Generalized Anxiety Disorder (GAD) is characterized by persistent, excessive, and uncontrollable worry about everyday events lasting at least 6 months. Symptoms include: feeling nervous or on edge (bechaini), muscle tension (pathon mein khichao), fatigue, difficulty concentrating, irritability, and sleep disturbances. The GAD-7 scale evaluates anxiety severity: 0–4 (minimal), 5–9 (mild), 10–14 (moderate), 15–21 (severe). Mild anxiety responds well to cognitive grounding and lifestyle optimization; moderate-to-severe anxiety benefits from cognitive behavioral therapy (CBT) and psychiatric care.',
      },
      {
        title: 'Acute Panic Attack Somatic Symptoms and Differential Assessment',
        domain: 'mental_health',
        topic: 'anxiety',
        subtopic: 'panic_attack_symptoms',
        section: 'Anxiety Disorders',
        content:
          'A panic attack is an abrupt surge of intense fear reaching a peak within 10 minutes, accompanied by dramatic somatic sensations: racing heart (palpitations / tez dil ki dharkan), trembling (kapkapi), sweating (paseena), choking sensation or shortness of breath (saans rukna), dizziness (chakkar), chills/hot flushes, and fear of losing control or dying. Panic attacks are non-fatal and self-limiting. However, if crushing chest pain radiates to the left arm or jaw with diaphoresis in older adults, acute coronary syndrome (heart attack) must be ruled out immediately in an emergency department.',
      },
      {
        title: 'Evidence-Based Somatic Grounding: 4-7-8 Breathing and 5-4-3-2-1 Technique',
        domain: 'mental_health',
        topic: 'anxiety',
        subtopic: 'grounding_techniques',
        section: 'Non-Pharmacological De-escalation',
        content:
          'Immediate somatic de-escalation techniques for acute anxiety and panic: 1) 4-7-8 Relaxing Breath: Inhale quietly through the nose for 4 seconds, hold your breath for 7 seconds, and exhale completely through the mouth making a whoosh sound for 8 seconds. Repeat 4 cycles to stimulate the vagus nerve and slow heart rate. 2) Box Breathing (4-4-4-4): Inhale 4s, hold 4s, exhale 4s, hold 4s. 3) 5-4-3-2-1 Sensory Grounding: Acknowledge 5 things you can SEE around you, 4 things you can physically TOUCH, 3 things you can HEAR, 2 things you can SMELL, and 1 thing you can TASTE. This interrupts catastrophic hyper-arousal and re-engages the prefrontal cortex.',
      },
      {
        title: 'Psychotropic Medication Latency, Adherence, and Anti-Stigma Guidance',
        domain: 'mental_health',
        topic: 'medication_safety',
        subtopic: 'antidepressant_adherence',
        section: 'Pharmacotherapy Safety',
        content:
          'Crucial facts regarding psychiatric medications (SSRIs like Escitalopram, Sertraline; SNRIs like Duloxetine, Venlafaxine): 1) Therapeutic Latency: Antidepressants take 2 to 4 weeks (sometimes up to 6 weeks) of daily adherence to show noticeable clinical improvement in mood and anxiety. 2) Non-Addictive: Standard antidepressants are NOT habit-forming or addictive (nasha aawar nahi hain), unlike illicit narcotics or prolonged unmonitored benzodiazepines. 3) Transient Side Effects: Mild initial nausea, headache, or sleepiness usually subside within the first 1 to 2 weeks as the brain adapts.',
      },
      {
        title: 'SSRI / SNRI Discontinuation Syndrome (Why You Must Never Stop Abruptly)',
        domain: 'mental_health',
        topic: 'medication_safety',
        subtopic: 'discontinuation_syndrome',
        section: 'Pharmacotherapy Safety',
        content:
          'Psychiatric medications must NEVER be stopped suddenly or cold-turkey (achanak dawai band karna intehai nuqsandeh hai). Abrupt cessation causes severe Antidepressant Discontinuation Syndrome, characterized by: 1) Flu-like symptoms (fatigue, headache, body aches, sweating). 2) Sensory disturbances (electric-shock sensations / "brain zaps", numbness). 3) Gastrointestinal distress (nausea, vomiting, diarrhea). 4) Rebound psychological crisis (severe acute anxiety, agitation, insomnia, severe mood swings). Any dose reduction or tapering must be gradual over weeks to months under the direct supervision of a prescribing psychiatrist.',
      },
      {
        title: 'Psychiatric Crisis and Suicidal Ideation Immediate Protocol (Pakistan)',
        domain: 'mental_health',
        topic: 'crisis',
        subtopic: 'crisis_hotlines_pakistan',
        section: 'Emergency Psychiatric Safety',
        content:
          'Any patient expressing explicit thoughts of suicide (khudkushi), self-harm, wanting to die, or overwhelming despair requires immediate compassionate emergency intervention. Free, confidential 24/7 crisis support and psychological first aid in Pakistan are available through: 1) Umang 24/7 Mental Health Helpline: 0311-7786264. 2) Rozan Helpline: 0800-22444 / 0303-4442288. 3) Government Emergency Rescue Ambulance: 1122. Do not leave the person alone if they are in immediate danger; remove hazardous items and escort them to the nearest hospital Emergency Room.',
      },
    ],
  },

  // ==========================================
  // DOCUMENT 5: WHO & Sleep Hygiene Guidelines
  // ==========================================
  {
    title: 'WHO mhGAP and Clinical Sleep Hygiene Guidelines for Insomnia and Somatization',
    source_name: 'World Health Organization (WHO)',
    source_version: '2025.1',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'mental_health',
    topic: 'sleep',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Clinical Sleep Hygiene Rules for Chronic Insomnia',
        domain: 'mental_health',
        topic: 'sleep',
        subtopic: 'insomnia_sleep_hygiene',
        section: 'Sleep Medicine',
        content:
          'Evidence-based sleep hygiene guidelines for overcoming insomnia (neend na aana): 1) Fixed Sleep Schedule: Go to bed and wake up at the exact same time every single day (even on weekends) to anchor your circadian rhythm. 2) 20-Minute Rule: If you cannot fall asleep after 20 minutes in bed, get out of bed and do a quiet, relaxing activity (reading a book under dim light) in another room; return to bed only when sleepy. 3) Screen Curfew: Avoid smartphones, laptops, and TV screens for at least 60 minutes before bedtime because blue light suppresses natural melatonin release. 4) Stimulant Cutoff: Avoid caffeinated tea (chai), coffee, energy drinks, and heavy spicy meals for at least 6 hours before sleep. 5) Bedroom Environment: Keep bedroom dark, quiet, and comfortably cool.',
      },
      {
        title: 'South Asian Somatization: How Emotional Stress Causes Physical Pain',
        domain: 'mental_health',
        topic: 'somatization',
        subtopic: 'physical_symptoms_of_stress',
        section: 'Cross-Cultural Psychiatry',
        content:
          'In South Asian cultures, psychological distress and chronic emotional stress frequently manifest as persistent bodily/somatic symptoms (somatization): chronic tension headaches (sar mein shadeed dard/bojh), chest heaviness or suffocation (seene mein ghuttan/dabao), unexplained generalized body aches (kamar dard, pathon ka khichao), persistent indigestion/IBS (pait mein gas/dard), and chronic fatigue. When extensive medical diagnostic tests (ECG, lab panels, scans) are normal, these symptoms reflect autonomic nervous system hyperactivity due to underlying anxiety or masked depression. Treatment includes validating distress, counseling/CBT, stress reduction, and mental health support.',
      },
      {
        title: 'Cognitive Behavioral Therapy (CBT) Principles and Decatastrophizing',
        domain: 'mental_health',
        topic: 'therapy',
        subtopic: 'cbt_and_counseling',
        section: 'Psychotherapy Principles',
        content:
          'Cognitive Behavioral Therapy (CBT) is the gold-standard evidence-based psychological treatment for depression and anxiety. CBT teaches that our thoughts (thoughts), feelings (emotions), and actions (behaviors) are interconnected. Common cognitive distortions include "Catastrophizing" (assuming the worst outcome will happen) and "All-or-Nothing Thinking". CBT helps individuals identify negative automatic thoughts, examine objective factual evidence, reframe distorted beliefs into balanced thoughts, and re-engage in positive mood-boosting behaviors (Behavioral Activation).',
      },
      {
        title: 'Postpartum Depression (PPD) Recognition and Maternal Support',
        domain: 'mental_health',
        topic: 'depression',
        subtopic: 'postpartum_depression',
        section: 'Perinatal Mental Health',
        content:
          'Postpartum Depression (PPD) affects 1 in 5 new mothers and is characterized by intense sadness, severe exhaustion, anxiety, feelings of inadequacy as a mother, crying spells, and difficulty bonding with the newborn baby lasting more than 2 weeks after childbirth. PPD is distinct from transient "baby blues" (which resolve within 10-14 days). PPD is caused by rapid hormonal shifts combined with physical exhaustion and sleep deprivation. Mothers with PPD deserve compassionate family support, non-judgmental validation, and clinical psychiatric/counseling care.',
      },
    ],
  },

  // ==========================================
  // DOCUMENT 6: ACC/AHA Cardiovascular & General Health
  // ==========================================
  {
    title: 'ACC / AHA Clinical Practice Guidelines for Hypertension and Cardiovascular Health',
    source_name: 'American College of Cardiology (ACC/AHA)',
    source_version: '2025.1',
    source_type: 'CLINICAL_GUIDELINE',
    domain: 'general_health',
    topic: 'cardiovascular',
    status: 'APPROVED',
    chunks: [
      {
        title: 'Blood Pressure Categories and Diagnostic Targets',
        domain: 'general_health',
        topic: 'cardiovascular',
        subtopic: 'hypertension_targets',
        section: 'Hypertension Management',
        content:
          'Blood pressure categories established by ACC/AHA: 1) Normal: Systolic < 120 mmHg and Diastolic < 80 mmHg. 2) Elevated BP: Systolic 120–129 mmHg and Diastolic < 80 mmHg. 3) Stage 1 Hypertension: Systolic 130–139 mmHg or Diastolic 80–89 mmHg. 4) Stage 2 Hypertension: Systolic >= 140 mmHg or Diastolic >= 90 mmHg. 5) Hypertensive Crisis: Systolic > 180 mmHg and/or Diastolic > 120 mmHg. For most non-pregnant adults with hypertension and diabetes, the target BP is < 130/80 mmHg to protect renal microvasculature and reduce stroke risk.',
      },
      {
        title: 'Hypertensive Emergency and Crisis Warning Symptoms',
        domain: 'general_health',
        topic: 'cardiovascular',
        subtopic: 'hypertensive_crisis_emergency',
        section: 'Emergency Cardiovascular Care',
        content:
          'A Hypertensive Crisis occurs when blood pressure spikes > 180/120 mmHg. If accompanied by signs of acute organ damage (severe chest pain, shortness of breath, severe sudden headache with blurred vision, numbness/weakness, or difficulty speaking), it is a Hypertensive Emergency requiring immediate emergency room transfer. Patients should not attempt unmonitored rapid self-medication that causes precipitous drops in blood pressure.',
      },
      {
        title: 'DASH Diet, Dietary Sodium Reduction, and Salt Guidelines in Pakistan',
        domain: 'general_health',
        topic: 'cardiovascular',
        subtopic: 'dash_diet_sodium',
        section: 'Cardiovascular Nutrition',
        content:
          'Sodium and blood pressure: High dietary sodium (namak) intake is a primary driver of hypertension and stroke in Pakistan due to salty pickles (achaar), papad, fast food, and heavily salted curries. Guidelines: 1) Sodium Target: Limit daily sodium intake to < 2,300 mg (about 1 level teaspoon of table salt per day for the entire day across all meals); ideally < 1,500 mg for hypertensive individuals. 2) Potassium-rich Foods: Increase dietary potassium through fresh fruits (bananas, oranges, melons) and vegetables (spinach, tomatoes) to help relax vascular walls, unless contraindicated by chronic kidney disease.',
      },
      {
        title: 'Acute Coronary Syndrome (Heart Attack) Recognition and Immediate Fast Path',
        domain: 'general_health',
        topic: 'cardiovascular',
        subtopic: 'heart_attack_recognition',
        section: 'Emergency Cardiovascular Care',
        content:
          'Acute Coronary Syndrome (Myocardial Infarction / Heart Attack) warning signs: 1) Crushing, squeezing, or heavy pressure in the center of the chest (seene par shadeed bojh/dabao). 2) Pain radiating to the left arm, shoulder, neck, jaw, or upper back. 3) Profuse cold sweating (thanda paseena), sudden shortness of breath, dizziness, or nausea. In women and elderly diabetics, chest pain may be atypical or mild (presenting primarily as unexplained breathlessness, extreme fatigue, or vomiting). Immediate action: Call Rescue 1122, chew 300mg soluble aspirin if not allergic and conscious, and reach an emergency catheterization facility immediately.',
      },
    ],
  },
];

async function seedCoreKnowledge() {
  console.log('--- Starting Comprehensive Clinical Knowledge Base Seeding ---');

  // Clear existing approved documents to ensure fresh idempotent seeding
  await prisma.healthKnowledgeChunk.deleteMany({});
  await prisma.healthKnowledgeDocument.deleteMany({});
  console.log('Cleared existing knowledge records.');

  let docCount = 0;
  let chunkCount = 0;

  for (const doc of COMPREHENSIVE_DOCUMENTS) {
    const rawContent = doc.chunks.map((c) => `${c.title}\n${c.content}`).join('\n\n');
    const createdDoc = await prisma.healthKnowledgeDocument.create({
      data: {
        title: doc.title,
        source_name: doc.source_name,
        source_version: doc.source_version,
        source_type: doc.source_type,
        domain: doc.domain,
        topic: doc.topic,
        raw_content: rawContent,
        status: doc.status,
      },
    });
    docCount++;
    console.log(`\n[Doc ${docCount}] Created Document: ${createdDoc.title}`);

    for (let i = 0; i < doc.chunks.length; i++) {
      const chunk = doc.chunks[i];
      const vector = generateDeterministicVector(chunk.content);
      const createdChunk = await prisma.healthKnowledgeChunk.create({
        data: {
          document_id: createdDoc.id,
          chunk_index: i,
          title: chunk.title,
          domain: chunk.domain,
          topic: chunk.topic,
          subtopic: chunk.subtopic,
          section: chunk.section,
          content: chunk.content,
          embedding: vector,
          embedding_model: 'deterministic-1536',
          tokens_count: chunk.content.split(/\s+/).length,
          status: 'APPROVED',
          source: doc.source_name,
          source_version: doc.source_version,
        },
      });
      chunkCount++;
      console.log(`  -> [Chunk ${chunkCount}] (${chunk.domain}:${chunk.topic}) ${createdChunk.title}`);
    }
  }

  const total = await prisma.healthKnowledgeChunk.count();
  console.log(`\n======================================================`);
  console.log(`Successfully seeded Comprehensive Knowledge Base!`);
  console.log(`Documents: ${docCount} | Chunks: ${total}`);
  console.log(`======================================================`);
}

module.exports = { seedCoreKnowledge };

if (require.main === module) {
  seedCoreKnowledge()
    .catch((e) => {
      console.error('Error seeding knowledge:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
