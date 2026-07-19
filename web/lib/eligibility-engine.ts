/**
 * ExamSetu — Client-side eligibility checking engine.
 * Pure TypeScript, deterministic, no LLM dependency.
 * Runs in the browser against verified rules fetched from Supabase.
 */

import type { EligibilityRule, EligibilityCheckResult, UserEligibilityInput } from "./types";

const EDU_HIERARCHY: Record<string, number> = {
  "10th": 1, "10th pass": 1, "high school": 1, "matric": 1,
  "12th": 2, "12th pass": 2, "intermediate": 2, "senior secondary": 2,
  "graduation": 3, "graduate": 3, "bachelor": 3, "b.a": 3, "b.sc": 3, "b.com": 3, "b.tech": 3, "b.e": 3,
  "post-graduation": 4, "post graduation": 4, "post-graduate": 4, "master": 4, "m.a": 4, "m.sc": 4, "m.tech": 4, "mba": 4,
};

function getEduLevel(education: string): number {
  const lower = education.toLowerCase().trim();
  for (const [key, level] of Object.entries(EDU_HIERARCHY)) {
    if (lower.includes(key)) return level;
  }
  return 0;
}

function calculateAge(dob: string, referenceDate?: string): number {
  const birth = new Date(dob);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function checkEligibility(
  input: UserEligibilityInput,
  rules: EligibilityRule[]
): EligibilityCheckResult[] {
  const results: EligibilityCheckResult[] = [];

  for (const rule of rules) {
    const reasons: string[] = [];
    let eligible = true;

    // --- Age check ---
    if (rule.min_age !== null && rule.max_age !== null) {
      const age = calculateAge(input.dob);
      const categoryUpper = input.category.toUpperCase();

      // Apply category relaxation
      const categoryRelax = rule.category_relaxations?.[categoryUpper]
        || rule.category_relaxations?.[input.category]
        || 0;

      // Apply gender relaxation
      const genderLower = input.gender.toLowerCase();
      const genderRelax = rule.gender_relaxations?.[genderLower] || 0;

      const effectiveMax = rule.max_age + categoryRelax + genderRelax;

      if (age < rule.min_age) {
        eligible = false;
        reasons.push(`Age ${age} is below minimum ${rule.min_age} years`);
      } else if (age > effectiveMax) {
        eligible = false;
        const relaxInfo = [];
        if (categoryRelax > 0) relaxInfo.push(`${input.category}: +${categoryRelax}y`);
        if (genderRelax > 0) relaxInfo.push(`${input.gender}: +${genderRelax}y`);
        const relaxStr = relaxInfo.length > 0 ? ` (relaxation: ${relaxInfo.join(", ")})` : "";
        reasons.push(`Age ${age} exceeds maximum ${effectiveMax}${relaxStr}`);
      } else {
        const relaxInfo = [];
        if (categoryRelax > 0) relaxInfo.push(`${input.category}: +${categoryRelax}y`);
        if (genderRelax > 0) relaxInfo.push(`${input.gender}: +${genderRelax}y`);
        const relaxStr = relaxInfo.length > 0 ? ` (relaxation: ${relaxInfo.join(", ")})` : "";
        reasons.push(`✅ Age ${age} is within ${rule.min_age}-${effectiveMax}${relaxStr}`);
      }
    }

    // --- Education check ---
    if (rule.education_requirement) {
      const userEduLevel = getEduLevel(input.education);
      const reqEduLevel = getEduLevel(rule.education_requirement);

      if (reqEduLevel > 0 && userEduLevel > 0) {
        if (userEduLevel >= reqEduLevel) {
          reasons.push(`✅ Education: ${input.education} meets "${rule.education_requirement}"`);
        } else {
          eligible = false;
          reasons.push(`Education: ${input.education} does not meet "${rule.education_requirement}"`);
        }
      } else {
        reasons.push(`⚠️ Education requirement: "${rule.education_requirement}" — please verify manually`);
      }
    }

    // --- Domicile check ---
    if (rule.domicile_requirement) {
      const reqDomicile = rule.domicile_requirement.toLowerCase();
      const userState = input.state.toLowerCase();

      if (reqDomicile.includes("none") || reqDomicile.includes("any") || reqDomicile.includes("all india")) {
        reasons.push(`✅ Domicile: Open to all states`);
      } else if (userState && reqDomicile.includes(userState)) {
        reasons.push(`✅ Domicile: ${input.state} matches requirement`);
      } else if (userState) {
        eligible = false;
        reasons.push(`Domicile: Requires "${rule.domicile_requirement}", your state is ${input.state}`);
      }
    }

    // --- Optional Advanced Criteria: Physical, Vision, Skill & Quotas ---
    const reqText = `${rule.post_name} ${rule.additional_requirements || ""} ${rule.education_requirement || ""}`.toLowerCase();

    // 1. Height Check (if provided)
    if (input.height_cm !== undefined && input.height_cm !== null && input.height_cm !== "") {
      const userHeight = Number(input.height_cm);
      if (!isNaN(userHeight) && userHeight > 0) {
        let minHeightReq: number | null = null;

        // Try extracting explicit height from rule text
        const isFemale = input.gender.toLowerCase() === "female";
        const isST = input.category.toUpperCase() === "ST";

        // Regex patterns for height in text
        const heightMatch = reqText.match(/height[:\s]*(\d{3})\s*cm/i) || reqText.match(/(\d{3})\s*cm/i);
        if (heightMatch) {
          minHeightReq = parseInt(heightMatch[1], 10);
        } else if (reqText.includes("constable") || reqText.includes("police") || reqText.includes("home guard") || reqText.includes("inspector")) {
          // Standard Police / Uniform standards in India
          if (isFemale) {
            minHeightReq = isST ? 147 : 152;
          } else {
            minHeightReq = isST ? 160 : 168;
          }
        }

        if (minHeightReq !== null) {
          if (userHeight < minHeightReq) {
            eligible = false;
            reasons.push(`📏 Height: ${userHeight} cm is below required ${minHeightReq} cm`);
          } else {
            reasons.push(`✅ Height: ${userHeight} cm meets minimum ${minHeightReq} cm requirement`);
          }
        }
      }
    }

    // 2. Chest & Expansion Check (if provided, applicable to male candidates)
    if (input.gender.toLowerCase() === "male" && input.chest_cm !== undefined && input.chest_cm !== null && input.chest_cm !== "") {
      const userChest = Number(input.chest_cm);
      const userExp = Number(input.chest_expansion_cm || 0);

      if (!isNaN(userChest) && userChest > 0) {
        let minChestReq = 79;
        if (input.category.toUpperCase() === "ST") minChestReq = 77;

        // Extract custom chest requirement if present in text
        const chestMatch = reqText.match(/chest[:\s]*(\d{2,3})/i);
        if (chestMatch) minChestReq = parseInt(chestMatch[1], 10);

        if (reqText.includes("constable") || reqText.includes("police") || reqText.includes("home guard") || reqText.includes("chest")) {
          let chestFailures = [];
          if (userChest < minChestReq) chestFailures.push(`Unexpanded ${userChest} cm < min ${minChestReq} cm`);
          if (userExp > 0 && userExp < 5) chestFailures.push(`Expansion ${userExp} cm < min 5 cm`);

          if (chestFailures.length > 0) {
            eligible = false;
            reasons.push(`📏 Chest Measurement: ${chestFailures.join(", ")}`);
          } else {
            reasons.push(`✅ Chest: ${userChest} cm with ${userExp || 5} cm expansion meets physical standards`);
          }
        }
      }
    }

    // 3. Physical Endurance / Running Test (if provided)
    if (input.running_capable !== undefined && input.running_capable !== null && input.running_capable !== "") {
      const isCapable = input.running_capable === true || input.running_capable === "true" || input.running_capable === "yes";
      const hasPhysicalTest = reqText.includes("run") || reqText.includes("running") || reqText.includes("pet") || reqText.includes("physical test") || reqText.includes("constable") || reqText.includes("police");

      if (hasPhysicalTest) {
        if (!isCapable) {
          eligible = false;
          reasons.push(`🏃 Physical Test: Candidate cannot complete required physical endurance / running test`);
        } else {
          reasons.push(`✅ Physical Test: Candidate confirms meeting physical running endurance test`);
        }
      }
    }

    // 4. Eye Vision Check (if provided)
    if (input.eye_vision) {
      const userVision = input.eye_vision.toLowerCase();
      if (reqText.includes("vision") || reqText.includes("6/6") || reqText.includes("police") || reqText.includes("driver")) {
        if (userVision.includes("6/12") || userVision.includes("worse")) {
          eligible = false;
          reasons.push(`👁️ Eye Vision: ${input.eye_vision} does not meet required 6/6 or 6/9 medical standards`);
        } else {
          reasons.push(`✅ Eye Vision: ${input.eye_vision} meets medical vision requirements`);
        }
      }
    }

    // 5. Typing Speed & Computer Certificate (if provided)
    if (input.computer_certificate || (input.typing_speed_wpm !== undefined && input.typing_speed_wpm !== null && input.typing_speed_wpm !== "")) {
      const userCert = (input.computer_certificate || "").toLowerCase();
      const userTyping = Number(input.typing_speed_wpm || 0);

      const requiresTyping = reqText.includes("typing") || reqText.includes("steno") || reqText.includes("clerk") || reqText.includes("asi");
      const requiresCCC = reqText.includes("ccc") || reqText.includes("o level") || reqText.includes("computer");

      if (requiresTyping && userTyping > 0) {
        if (userTyping < 25) {
          eligible = false;
          reasons.push(`⌨️ Typing Speed: ${userTyping} WPM is below minimum 25/30 WPM required for clerical/ASI posts`);
        } else {
          reasons.push(`✅ Typing Speed: ${userTyping} WPM meets clerical requirement`);
        }
      }

      if (requiresCCC) {
        if (userCert === "none" || !userCert) {
          reasons.push(`⚠️ Computer Cert: Post requires CCC / Computer Certificate — candidate marked none`);
        } else {
          reasons.push(`✅ Computer Cert: ${input.computer_certificate} meets post computer qualification`);
        }
      }
    }

    // 6. PwD (Disability) Quota & Restrictions
    if (input.is_pwd === true || input.is_pwd === "true" || input.is_pwd === "yes") {
      if (reqText.includes("police") || reqText.includes("constable") || reqText.includes("uniform") || reqText.includes("not eligible for pwd")) {
        eligible = false;
        reasons.push(`♿ PwD Status: Uniform/Police posts are not open for PwD candidates`);
      } else {
        reasons.push(`✅ PwD Quota: Eligible under PwD reservation & age relaxations`);
      }
    }

    // 7. Ex-Serviceman Status
    if (input.is_ex_serviceman === true || input.is_ex_serviceman === "true" || input.is_ex_serviceman === "yes") {
      reasons.push(`🎖️ Ex-Serviceman: Eligible for Ex-Serviceman quota & military service age deduction`);
    }

    results.push({
      post_name: rule.post_name,
      eligible,
      reasons,
      source_page_ref: rule.source_page_ref,
    });
  }

  return results;
}
