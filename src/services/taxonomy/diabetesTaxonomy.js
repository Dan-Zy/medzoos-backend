/**
 * Diabetes Medical Taxonomy & Multilingual Term Catalog
 * Centralized, server-validated taxonomy for Diabetes Mellitus education and management.
 */

const DIABETES_TOPICS = {
  basics: {
    name: 'basics',
    title: 'Diabetes Basics & Overview',
    description: 'Understanding diabetes, insulin biology, and glucose metabolism.',
    subtopics: ['what_is_diabetes', 'insulin_function', 'metabolism_overview'],
    synonyms: [
      'what is diabetes', 'sugar kya hoti hai', 'diabetes basics',
      'sugar ki bimari', 'sugar kaise hoti hai', 'insulin kya hai'
    ]
  },
  types: {
    name: 'types',
    title: 'Types of Diabetes',
    description: 'Classification of Type 1, Type 2, Gestational, Prediabetes, and other types.',
    subtopics: ['type_1', 'type_2', 'gestational_diabetes', 'prediabetes', 'lada_mody'],
    synonyms: [
      'type 1 diabetes', 'type 2 diabetes', 'prediabetes', 'gestational diabetes',
      'sugar ki aqsam', 'type 1 or type 2 farq', 'borderline sugar'
    ]
  },
  symptoms: {
    name: 'symptoms',
    title: 'Diabetes Symptoms & Signs',
    description: 'Classic and subtle symptoms of elevated blood glucose.',
    subtopics: ['frequent_urination', 'excessive_thirst', 'unexplained_weight_loss', 'fatigue', 'blurry_vision'],
    synonyms: [
      'diabetes symptoms', 'sugar ki alamat', 'peshab bar bar aana',
      'ziada pyas lagna', 'sugar ke lakshan', 'wazan kam hona sugar'
    ]
  },
  blood_glucose: {
    name: 'blood_glucose',
    title: 'Blood Glucose Levels & Targets',
    description: 'Fasting, postprandial, and random glucose thresholds and target ranges.',
    subtopics: ['fasting_glucose', 'postprandial_glucose', 'random_glucose', 'target_ranges'],
    synonyms: [
      'fasting sugar', 'blood sugar', 'random sugar', 'khali pait sugar',
      'khana khane k baad sugar', 'glucose reading', 'sugar level kitna hona chahiye',
      'normal sugar range', 'sugar kitni honi chahiye'
    ]
  },
  hba1c: {
    name: 'hba1c',
    title: 'HbA1c (3-Month Glycated Hemoglobin)',
    description: 'Understanding HbA1c test, 3-month average glucose, target values, and interpretation.',
    subtopics: ['interpretation', 'target_range', 'test_frequency', 'estimated_average_glucose'],
    synonyms: [
      '3 month wali sugar', 'three month sugar', 'hba1c', 'a1c', 'a1c test',
      'glycated hemoglobin', 'teen maah ki sugar', 'teen mahinay ka sugar test',
      'average sugar test', 'hba1c report', 'sugar ka pichla record'
    ]
  },
  hypoglycemia: {
    name: 'hypoglycemia',
    title: 'Hypoglycemia (Low Blood Sugar)',
    description: 'Recognizing, preventing, and treating low blood glucose (< 70 mg/dL). Rule of 15.',
    subtopics: ['symptoms', 'rule_of_15', 'emergency_treatment', 'prevention', 'nocturnal_hypo'],
    synonyms: [
      'sugar low', 'sugar gir gayi', 'hypoglycemia', 'low blood sugar',
      'sugar kam ho gayi', 'kapkapi paseena sugar', 'sugar drop',
      'sugar low hone par kya karein', 'rule of 15 sugar'
    ]
  },
  hyperglycemia: {
    name: 'hyperglycemia',
    title: 'Hyperglycemia (High Blood Sugar)',
    description: 'Causes, signs, and management of elevated blood sugar (> 180-250 mg/dL).',
    subtopics: ['causes', 'symptoms', 'ketones_screening', 'sick_day_rules', 'correction_steps'],
    synonyms: [
      'sugar high', 'sugar barh gayi', 'hyperglycemia', 'high blood glucose',
      'sugar 250', 'sugar 300', 'sugar kam kaise karein', 'high sugar symptoms'
    ]
  },
  medications: {
    name: 'medications',
    title: 'Diabetes Medications & Insulin',
    description: 'Educational overview of oral antidiabetic agents and insulin regimens.',
    subtopics: ['metformin', 'sulfonylureas', 'sglt2_inhibitors', 'dpp4_inhibitors', 'insulin_therapy', 'storage_safety'],
    synonyms: [
      'metformin', 'glimepiride', 'insulin injection', 'sugar ki goli',
      'sugar ki dawai', 'insulin dose', 'sugar medicine', 'insulin lagane ka tareeqa',
      'januvia', 'empagliflozin', 'jardiance'
    ]
  },
  nutrition: {
    name: 'nutrition',
    title: 'Diabetes Nutrition & Meal Planning',
    description: 'Glycemic index, carbohydrate management, local dietary staples, and balanced meals.',
    subtopics: ['carbohydrate_counting', 'glycemic_index', 'fruits_portion', 'pakistani_diet_tips', 'beverages'],
    synonyms: [
      'diabetes diet', 'sugar mein kya khayein', 'sugar parhez', 'fruits in diabetes',
      'mango in diabetes', 'rice in diabetes', 'sugar patient roti rice',
      'sugar food chart', 'sugar mein aam kha sakte hain', 'meetha in diabetes'
    ]
  },
  exercise: {
    name: 'exercise',
    title: 'Physical Activity & Exercise Safety',
    description: 'Safe exercise protocols, hypoglycemia prevention during workouts, and timing.',
    subtopics: ['aerobic_exercise', 'resistance_training', 'workout_timing', 'hydration_safety', 'hypo_prevention'],
    synonyms: [
      'walk in diabetes', 'exercise for sugar', 'sugar mein walk',
      'sugar patient workout', 'walking timing diabetes', 'exercise se sugar kam'
    ]
  },
  monitoring: {
    name: 'monitoring',
    title: 'Glucose Monitoring & Self-Check',
    description: 'Glucometer usage, strip testing, continuous glucose monitors (CGM), and log keeping.',
    subtopics: ['glucometer_use', 'testing_schedule', 'cgm_devices', 'logbook_tracking'],
    synonyms: [
      'glucometer', 'sugar check karne ka tareeqa', 'sugar machine',
      'cgm sensor', 'sugar kab check karein', 'sugar diary'
    ]
  },
  complications: {
    name: 'complications',
    title: 'Long-term Diabetes Complications',
    description: 'Prevention and screening for microvascular and macrovascular complications.',
    subtopics: ['eye_health', 'kidney_health', 'nerve_health', 'foot_health', 'cardiovascular_health'],
    synonyms: [
      'diabetes complications', 'sugar ke nuqsanaat', 'sugar se asarat',
      'sugar ki waja se masail', 'long term diabetes risks'
    ]
  },
  eye_health: {
    name: 'eye_health',
    title: 'Diabetic Eye Health (Retinopathy)',
    description: 'Diabetic retinopathy screening, annual dilated eye exam, and vision protection.',
    subtopics: ['retinopathy_screening', 'annual_eye_exam', 'blurry_vision_warning', 'cataracts_glaucoma'],
    synonyms: [
      'retinopathy', 'sugar ki waja se aankhein', 'diabetic eye',
      'nazar kamzor sugar', 'aankhon ka checkup diabetes', 'eye damage sugar'
    ]
  },
  kidney_health: {
    name: 'kidney_health',
    title: 'Diabetic Kidney Health (Nephropathy)',
    description: 'Microalbuminuria, eGFR testing, blood pressure control, and kidney protection.',
    subtopics: ['microalbuminuria_test', 'egfr_monitoring', 'hypertension_control', 'kidney_protection'],
    synonyms: [
      'nephropathy', 'gurde par sugar ka asar', 'diabetic kidney',
      'microalbumin test', 'sugar kidney test', 'protein in urine sugar'
    ]
  },
  nerve_health: {
    name: 'nerve_health',
    title: 'Diabetic Neuropathy (Nerve Health)',
    description: 'Peripheral and autonomic neuropathy, tingling, numbness, and burning feet.',
    subtopics: ['peripheral_neuropathy', 'tingling_burning', 'numbness', 'autonomic_symptoms'],
    synonyms: [
      'neuropathy', 'haath paon sunn', 'sunn pan', 'tingling feet',
      'paon mein jalan', 'nerves damage sugar', 'paon mein sooyian chubhna'
    ]
  },
  foot_health: {
    name: 'foot_health',
    title: 'Diabetic Foot Care & Ulcer Prevention',
    description: 'Daily foot inspection, proper footwear, wound prevention, and podiatry care.',
    subtopics: ['daily_inspection', 'proper_footwear', 'wound_care_rules', 'infection_red_flags'],
    synonyms: [
      'diabetic foot', 'pair ka zakham', 'paon ka ulcer', 'foot wound diabetes',
      'diabetic shoes', 'paon ki dekh bhaal', 'pair ka chala sugar'
    ]
  },
  cardiovascular_health: {
    name: 'cardiovascular_health',
    title: 'Cardiovascular Health in Diabetes',
    description: 'Heart disease risk, blood pressure targets, lipid/cholesterol control in diabetes.',
    subtopics: ['blood_pressure_target', 'lipid_panel_targets', 'heart_attack_prevention', 'stroke_risk'],
    synonyms: [
      'sugar and heart', 'dil aur sugar', 'diabetic heart disease',
      'cholesterol in diabetes', 'blood pressure with diabetes'
    ]
  },
  laboratory_tests: {
    name: 'laboratory_tests',
    title: 'Recommended Diagnostic & Routine Tests',
    description: 'Overview of lab tests needed for comprehensive diabetes monitoring.',
    subtopics: ['hba1c_test', 'lipid_profile', 'serum_creatinine', 'urine_acr', 'liver_enzymes'],
    synonyms: [
      'sugar tests list', 'diabetes lab tests', 'sugar ke kon kon se test',
      'hba1c test', 'lipid test sugar', 'urine test for diabetes'
    ]
  },
  pregnancy: {
    name: 'pregnancy',
    title: 'Diabetes in Pregnancy (Gestational & Pre-existing)',
    description: 'Glycemic management during pregnancy, OGTT screening, fetal and maternal health.',
    subtopics: ['gestational_screening_ogtt', 'target_ranges_pregnancy', 'fetal_monitoring', 'postpartum_followup'],
    synonyms: [
      'pregnancy mein sugar', 'gestational diabetes', 'hamal mein sugar',
      'sugar test during pregnancy', 'pregnancy sugar targets'
    ]
  },
  prevention: {
    name: 'prevention',
    title: 'Diabetes Prevention & Prediabetes Reversal',
    description: 'Evidence-based lifestyle modification to prevent or delay Type 2 Diabetes.',
    subtopics: ['weight_loss_targets', 'dietary_shifts', 'activity_goals', 'prediabetes_reversal'],
    synonyms: [
      'sugar se bachao', 'prevent diabetes', 'prediabetes reversal',
      'sugar hone se kaise bachein', 'sugar prevention tips'
    ]
  },
  daily_management: {
    name: 'daily_management',
    title: 'Daily Self-Care & Lifestyle Routine',
    description: 'Practical daily routines, traveling with insulin, sick-day management, and hygiene.',
    subtopics: ['daily_routine', 'travel_precautions', 'sick_day_management', 'stress_impact'],
    synonyms: [
      'daily sugar routine', 'sugar patient ka daily schedule', 'travel with insulin',
      'sick day rules diabetes', 'sugar management in ramadan', 'roza aur sugar'
    ]
  }
};

module.exports = {
  DOMAIN: 'diabetes',
  TOPICS: DIABETES_TOPICS,
  TOPIC_KEYS: Object.keys(DIABETES_TOPICS),
};
