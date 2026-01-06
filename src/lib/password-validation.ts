// Common passwords to block (top 100 most used)
const BLOCKED_PASSWORDS = [
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
  "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
  "ashley", "bailey", "passw0rd", "shadow", "123123", "654321", "superman",
  "qazwsx", "michael", "football", "password1", "password123", "welcome",
  "welcome1", "admin", "admin123", "login", "starwars", "hello", "charlie",
  "donald", "password!", "qwerty123", "access", "flower", "hottie", "loveme",
  "cheese", "internet", "killer", "soccer", "harley", "hockey", "computer",
  "jordan23", "mustang", "pepper", "ranger", "thomas", "buster", "tigger",
  "robert", "hunter", "batman", "trustno", "jennifer", "andrew", "joshua",
  "1qaz2wsx", "123qwe", "zxcvbnm", "asdfghjk", "qwertyuiop", "1234qwer",
  "654321", "michael1", "passw0rd", "password2", "111111", "666666", "000000",
  "121212", "7777777", "987654321", "696969", "888888", "777777", "1q2w3e4r",
  "12345678910", "qwerty1", "qwerty12", "qwerty123456", "administrator", "root",
  "1234567890", "test", "test123", "guest", "guest123", "changeme", "default",
  "velkommen", "kodeord", "adgangskode", "hejmeddig", "cphsales", "salg123"
];

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  errors: string[];
  suggestions: string[];
}

export interface PasswordRequirement {
  key: string;
  label: string;
  validator: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    key: "length",
    label: "Mindst 8 tegn",
    validator: (p) => p.length >= 8,
  },
  {
    key: "uppercase",
    label: "Mindst ét stort bogstav (A-Z)",
    validator: (p) => /[A-Z]/.test(p),
  },
  {
    key: "lowercase",
    label: "Mindst ét lille bogstav (a-z)",
    validator: (p) => /[a-z]/.test(p),
  },
  {
    key: "number",
    label: "Mindst ét tal (0-9)",
    validator: (p) => /[0-9]/.test(p),
  },
  {
    key: "special",
    label: "Mindst ét specialtegn (!@#$%^&*)",
    validator: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
  },
];

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check each requirement
  const requirementResults = PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    passed: req.validator(password),
  }));

  // Count passed requirements
  const passedCount = requirementResults.filter((r) => r.passed).length;

  // Add errors for failed requirements
  requirementResults.forEach((req) => {
    if (!req.passed) {
      errors.push(req.label);
    }
  });

  // Check for blocked passwords
  if (BLOCKED_PASSWORDS.includes(password.toLowerCase())) {
    errors.push("Adgangskoden er for almindelig og kan ikke bruges");
  }

  // Calculate score (0-4)
  if (passedCount === 5 && !BLOCKED_PASSWORDS.includes(password.toLowerCase())) {
    score = 4; // All requirements met
    if (password.length >= 12) {
      score = 4; // Extra strong
    } else {
      score = 3;
    }
  } else if (passedCount >= 4) {
    score = 3;
  } else if (passedCount >= 3) {
    score = 2;
  } else if (passedCount >= 2) {
    score = 1;
  } else {
    score = 0;
  }

  // Add suggestions
  if (password.length < 12) {
    suggestions.push("Brug mindst 12 tegn for ekstra sikkerhed");
  }
  if (!/[!@#$%^&*]/.test(password) && passedCount >= 4) {
    suggestions.push("Tilføj specialtegn for at styrke din adgangskode");
  }

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return "Meget svag";
    case 1:
      return "Svag";
    case 2:
      return "Middel";
    case 3:
      return "Stærk";
    case 4:
      return "Meget stærk";
    default:
      return "Ukendt";
  }
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
      return "bg-destructive";
    case 1:
      return "bg-orange-500";
    case 2:
      return "bg-yellow-500";
    case 3:
      return "bg-green-500";
    case 4:
      return "bg-emerald-500";
    default:
      return "bg-muted";
  }
}
