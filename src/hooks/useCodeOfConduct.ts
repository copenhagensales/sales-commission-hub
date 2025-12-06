import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

// All 31 questions with correct answers
export const CODE_OF_CONDUCT_QUESTIONS = [
  {
    id: 1,
    question: "En kunde beder dig om at slette deres nummer fra vores database og siger tydeligt, at de ikke ønsker at blive kontaktet igen. Hvad gør du?",
    options: [
      'Trykker "kunden ønsker ikke at blive kontaktet" / "må ikke kontaktes"',
      'Trykker "ikke interesseret"',
      'Trykker "telefonsvarer"',
    ],
    correctAnswer: 'Trykker "kunden ønsker ikke at blive kontaktet" / "må ikke kontaktes"',
  },
  {
    id: 2,
    question: 'En kunde er meget flabet og irriterende og beder om at få deres oplysninger slettet. Du vælger i stedet at markere kunden som "telefonsvarer", velvidende at de så bliver ringet op af en kollega. Hvilke konsekvenser kan dette have for dit job i yderste instans?',
    options: [
      "Ingen – jeg siger bare, at det var et uheld",
      "En løftet pegefinger",
      "En advarsel",
      "Bortvisning fra Copenhagen Sales",
    ],
    correctAnswer: "Bortvisning fra Copenhagen Sales",
  },
  {
    id: 3,
    question: "Du skal optage din obligatoriske opsummering af salget. Hvad skal du gøre for at overholde GDPR?",
    options: [
      "Før jeg optager, informerer jeg kunden om, at opsummeringen optages til dokumentation, og spørger om det er okay.",
      "Jeg optager samtalen og fortæller det til kunden, hvis de spørger.",
    ],
    correctAnswer: "Før jeg optager, informerer jeg kunden om, at opsummeringen optages til dokumentation, og spørger om det er okay.",
  },
  {
    id: 4,
    question: "Må du lave et opslag på sociale medier og skrive, at hvis nogen gerne vil have et godt tilbud (din kampagne), så kan de bare kontakte dig – uden at det er godkendt af Copenhagen Sales/kunden?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 5,
    question: "Må du printe og dele flyers ud til dine naboer, hvor de kan få gode tilbud gennem dig – uden at det er godkendt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 6,
    question: "Du ser en diskussion på nettet, der omhandler et af de produkter, du sælger. Må du skrive i diskussionen, at du arbejder for kunden og kan kontaktes, uden at det er aftalt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 7,
    question: "Man må gerne opfinde nye produktnavne, så det lyder mere attraktivt for kunden, selvom det ikke er et officielt produktnavn.",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 8,
    question: "Efter et salg er gennemført, må man så gemme personfølsomme oplysninger (fx CPR-nummer, registreringsnummer, kontonummer) på papir eller andre steder end de systemer, kunden og Copenhagen Sales har godkendt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 9,
    question: "Hvordan informerer du korrekt en kunde om deres annulleringsperiode ved salg til private?",
    options: [
      "Jeg informerer kunden om, at de har 14 dage til at teste, om produktet er det rette for dem.",
      "Jeg informerer kunden om deres 14 dages annullerings-/fortrydelsesret.",
    ],
    correctAnswer: "Jeg informerer kunden om deres 14 dages annullerings-/fortrydelsesret.",
  },
  {
    id: 10,
    question: "Du sælger et produkt, men undlader bevidst at informere om væsentlige detaljer for at få kunden til at købe. Er det i orden?",
    options: [
      "Det er ikke i orden, da vi skal sikre, at kunden får alle væsentlige oplysninger, før de godkender en aftale. Det er vores ansvar at være transparente og give korrekt information.",
      "Det er bare sådan, det er med salg.",
      "Kunden har selv ansvar for at læse en aftale, før de underskriver den eller siger ja.",
    ],
    correctAnswer: "Det er ikke i orden, da vi skal sikre, at kunden får alle væsentlige oplysninger, før de godkender en aftale. Det er vores ansvar at være transparente og give korrekt information.",
  },
  {
    id: 11,
    question: "Må man dele emner mellem kampagner/brands? For eksempel hvis en TDC-kunde spørger om en privat aftale, og du tilbyder at få en kollega fra Eesy til at kontakte dem – uden at kunden udtrykkeligt har sagt ja til det?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 12,
    question: "Må du kontakte en kunde via et telefonnummer, der ikke er i ringesystemet? For eksempel et nummer, du har fået fra en ven eller fundet på sociale medier?",
    options: ["Nej", "Ja"],
    correctAnswer: "Nej",
  },
  {
    id: 13,
    question: "Ved afslutningen af et salgskald skal du huske at lave en opsummering. Hvordan skal den udføres?",
    options: [
      "Opsummeringen skal være 100 % ordret – kunden skal kunne genkende aftalen, og du må ikke ændre indholdet.",
      "Jeg skal kun tage de vigtigste elementer fra opsummeringen og gengive dem med mine egne ord.",
    ],
    correctAnswer: "Opsummeringen skal være 100 % ordret – kunden skal kunne genkende aftalen, og du må ikke ændre indholdet.",
  },
  {
    id: 14,
    question: "Ved afslutningen af et salgskald skal du huske at lave en opsummering. Hvad kan konsekvensen være, hvis du glemmer det?",
    options: [
      "Jeg kan få fratrukket min provision, og hvis der kommer en klage, har Copenhagen Sales ikke mulighed for at bevise, at jeg har gennemført salget korrekt.",
      "Ikke noget, så længe salget er godt.",
    ],
    correctAnswer: "Jeg kan få fratrukket min provision, og hvis der kommer en klage, har Copenhagen Sales ikke mulighed for at bevise, at jeg har gennemført salget korrekt.",
  },
  {
    id: 15,
    question: "Hvad kan konsekvensen være, hvis jeg bevidst lyver eller vildleder en kunde om et produkt?",
    options: [
      "Jeg kan miste mit job og blive bortvist.",
      "Jeg kan blive flyttet over på en anden opgave.",
      "Jeg kan få en advarsel.",
    ],
    correctAnswer: "Jeg kan miste mit job og blive bortvist.",
  },
  {
    id: 16,
    question: "Må vi love noget til en kunde, hvis vi ikke med sikkerhed ved, at vi kan levere det?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 17,
    question: "Hvilke etiske overvejelser skal vi gøre os, når vi sælger produkter eller tjenester til sårbare kunder?",
    options: [
      "Vi skal sikre, at kunden forstår, hvad de siger ja til, og er i stand til at træffe en informeret beslutning. Vi sælger ikke til personer, der lyder berusede, forvirrede, meget gamle eller på anden måde ikke virker i stand til at vurdere deres beslutning.",
      "Så længe kunden er over 18 år og myndig, må vi sælge til dem.",
    ],
    correctAnswer: "Vi skal sikre, at kunden forstår, hvad de siger ja til, og er i stand til at træffe en informeret beslutning. Vi sælger ikke til personer, der lyder berusede, forvirrede, meget gamle eller på anden måde ikke virker i stand til at vurdere deres beslutning.",
  },
  {
    id: 18,
    question: "Du er træt en dag – må du lægge på, så snart kunden tager røret, for at få en pause?",
    options: [
      "Du må aldrig lægge røret på, når kunden tager telefonen! Du skal altid præsentere dig selv, når en kunde besvarer dit opkald, og må derfor ikke afslutte opkaldet uden at have præsenteret dig selv. Manglende efterlevelse af denne regel anses som grov misligholdelse af ansættelsesaftalen.",
      "Det er fint – bare det ikke er for mange gange i træk.",
    ],
    correctAnswer: "Du må aldrig lægge røret på, når kunden tager telefonen! Du skal altid præsentere dig selv, når en kunde besvarer dit opkald, og må derfor ikke afslutte opkaldet uden at have præsenteret dig selv. Manglende efterlevelse af denne regel anses som grov misligholdelse af ansættelsesaftalen.",
  },
  {
    id: 19,
    question: "Du kommer i en diskussion med en meget sur og uhøflig kunde. Hvordan afslutter du samtalen på en professionel måde?",
    options: [
      "Jeg taler til kunden, som kunden taler til mig.",
      "Jeg smider røret på – kunden forstår ikke andet.",
      "Jeg afslutter samtalen høfligt og professionelt, ønsker kunden en god dag og lader mig ikke påvirke af kundens tone.",
    ],
    correctAnswer: "Jeg afslutter samtalen høfligt og professionelt, ønsker kunden en god dag og lader mig ikke påvirke af kundens tone.",
  },
  {
    id: 20,
    question: 'Må du notere "kunden er syg/har diabetes" i CRM for at forstå kundens behov?',
    options: [
      "Ja, hvis det hjælper salget.",
      "Nej, undlad – det er følsomme oplysninger.",
    ],
    correctAnswer: "Nej, undlad – det er følsomme oplysninger.",
  },
  {
    id: 21,
    question: 'En prospect siger: "Kontakt mig ikke mere." Hvad gør du?',
    options: [
      "Stopper e-mails, men ringer fortsat.",
      'Stopper al kontakt og markerer "må ikke kontaktes" i ringesystemet.',
      "Sletter alle data straks uden registrering.",
    ],
    correctAnswer: 'Stopper al kontakt og markerer "må ikke kontaktes" i ringesystemet.',
  },
  {
    id: 22,
    question: "Må jeg selv lægge numre ind i dialeren? Fx fra en person, jeg møder til en familiefest, eller finder online, som jeg tænker kunne blive en god kunde?",
    options: [
      "Ja, det er fint.",
      "Nej, jeg må aldrig selv oprette emner.",
    ],
    correctAnswer: "Nej, jeg må aldrig selv oprette emner.",
  },
  {
    id: 23,
    question: "Jeg har adgang til kundens system og kan tilgå forskellige ting i systemet. Må jeg fx tage emner over fra kundens system og ringe på dem i ringesystemet, selvom det ikke er aftalt?",
    options: [
      "Ja, for kunden er glad for, at jeg er kreativ, og de får nye kunder – det er det vigtigste.",
      "Nej, det er et alvorligt brud på GDPR og virksomhedens regler. Det kan medføre bortvisning og skade kundens tillid.",
      "Ja, men kun hvis ingen opdager det.",
      "Ja, så længe jeg deler salget med virksomheden.",
    ],
    correctAnswer: "Nej, det er et alvorligt brud på GDPR og virksomhedens regler. Det kan medføre bortvisning og skade kundens tillid.",
  },
  {
    id: 24,
    question: 'Du oplever, at en kollega bevidst bryder GDPR- eller adfærdsreglerne (fx ringer på et nummer, der er markeret "må ikke kontaktes"). Hvad er den rigtige handling?',
    options: [
      "Jeg blander mig ikke – det er mellem kollegaen og ledelsen.",
      "Jeg taler med kollegaen og siger, de skal stoppe, men gør ikke mere.",
      "Jeg informerer min teamleder eller nærmeste leder, så virksomheden kan håndtere det korrekt.",
    ],
    correctAnswer: "Jeg informerer min teamleder eller nærmeste leder, så virksomheden kan håndtere det korrekt.",
  },
  {
    id: 25,
    question: "Din kollega har glemt sit login til systemet og beder om at låne dit brugernavn og password. Hvad gør du?",
    options: [
      "Jeg låner selvfølgelig mine login-oplysninger – vi skal jo bare have kampagnen til at køre.",
      "Jeg siger nej, fordi login er personligt, og henviser kollegaen til at få hjælp via de officielle kanaler (leder/IT).",
      "Jeg giver kun mit login, når lederen siger, det er okay.",
    ],
    correctAnswer: "Jeg siger nej, fordi login er personligt, og henviser kollegaen til at få hjælp via de officielle kanaler (leder/IT).",
  },
  {
    id: 26,
    question: "Du opdager, at du kan give dig selv eller en ven/familie en særlig fordel ved at manipulere med et salg (fx ekstra rabat eller gratis produkt), som ikke er aftalt. Hvad gør du?",
    options: [
      "Jeg gør det – det skader jo ikke, og kunden er glad.",
      "Jeg spørger først, om kollegaerne også vil have samme mulighed.",
      "Jeg gør det ikke og informerer min teamleder, hvis jeg er i tvivl – det kan være snyd og illoyal adfærd overfor kunden og samarbejdspartneren.",
    ],
    correctAnswer: "Jeg gør det ikke og informerer min teamleder, hvis jeg er i tvivl – det kan være snyd og illoyal adfærd overfor kunden og samarbejdspartneren.",
  },
  {
    id: 27,
    question: "Du opdager efter samtalen, at du har givet en forkert oplysning til kunden (fx pris, binding eller vilkår). Hvad gør du?",
    options: [
      "Ingenting – kunden opdager det nok ikke.",
      "Jeg kontakter min teamleder med det samme, så vi kan rette op på fejlen og evt. kontakte kunden igen.",
      "Jeg håber, at opsummeringen lyder overbevisende nok.",
    ],
    correctAnswer: "Jeg kontakter min teamleder med det samme, så vi kan rette op på fejlen og evt. kontakte kunden igen.",
  },
  {
    id: 28,
    question: "Du møder på arbejde og kan mærke, at du stadig er påvirket efter en bytur aftenen før (sløv, uklar, måske stadig lidt fuld). Hvad er korrekt?",
    options: [
      "Det er fint, så længe jeg kan tale og sælge.",
      "Jeg informerer min leder og går ikke i gang med at ringe til kunder, når jeg ikke er skarp og professionel.",
      "Jeg tager kun korte kald, hvor jeg ikke sælger noget.",
    ],
    correctAnswer: "Jeg informerer min leder og går ikke i gang med at ringe til kunder, når jeg ikke er skarp og professionel.",
  },
  {
    id: 29,
    question: "Må du kopiere kunders personoplysninger (navn, telefonnummer, aftaleinfo osv.) ind i eksterne værktøjer eller AI-tjenester, som ikke er godkendt af Copenhagen Sales eller kunden?",
    options: [
      "Ja, det er fint, hvis det hjælper mig med at lave et bedre salg.",
      "Kun hvis jeg sletter data bagefter.",
      "Nej, kundedata må kun bruges i de systemer, som Copenhagen Sales og kunden har godkendt.",
    ],
    correctAnswer: "Nej, kundedata må kun bruges i de systemer, som Copenhagen Sales og kunden har godkendt.",
  },
  {
    id: 30,
    question: "Du trænger til en pause, men systemet ringer videre. Hvad er den korrekte måde at tage en pause på?",
    options: [
      "Lade opkaldene gå igennem og lægge røret på, så snart kunden svarer.",
      "Lade telefonen ringe igennem uden at tage den, så systemet selv lægger på.",
      "Bruge de officielle pause-/wrap-up-funktioner i systemet eller aftale en pause med teamlederen.",
    ],
    correctAnswer: "Bruge de officielle pause-/wrap-up-funktioner i systemet eller aftale en pause med teamlederen.",
  },
  {
    id: 31,
    question: "Du har en meget høj annulleringsrate på dine salg. Er det acceptabelt?",
    options: [
      "Nej, det er ikke acceptabelt. Meget høje annulleringsrater betyder, at kundeservice bruger unødig tid på behandling af sager, og det er et tegn på, at salget er lavet dårligt eller utydeligt.",
      "Ja, det er okay – jeg bliver jo bare trukket i provision, så det er kun mit eget problem.",
    ],
    correctAnswer: "Nej, det er ikke acceptabelt. Meget høje annulleringsrater betyder, at kundeservice bruger unødig tid på behandling af sager, og det er et tegn på, at salget er lavet dårligt eller utydeligt.",
  },
];

// Check if quiz has expired (every 2 months = 60 days)
function isQuizExpired(passedAt: string): boolean {
  const passedDate = new Date(passedAt);
  const daysSincePassed = differenceInDays(new Date(), passedDate);
  return daysSincePassed >= 60; // 2 months
}

// Check if employee is within initial 14-day grace period
function isWithinInitialGracePeriod(employmentStartDate: string | null): boolean {
  if (!employmentStartDate) return false;
  const startDate = new Date(employmentStartDate);
  const daysSinceStart = differenceInDays(new Date(), startDate);
  return daysSinceStart < 14;
}

// Get deadline date (7 days after the 1st of the month when quiz becomes due)
function getDeadlineDate(passedAt: string | null, employmentStartDate: string | null): Date {
  const now = new Date();
  
  // For new employees: 14 days from start + 7 days grace
  if (employmentStartDate) {
    const startDate = new Date(employmentStartDate);
    const daysSinceStart = differenceInDays(now, startDate);
    
    // If within initial 14 days, deadline is 21 days from start
    if (daysSinceStart < 14) {
      const deadlineDate = new Date(startDate);
      deadlineDate.setDate(deadlineDate.getDate() + 21); // 14 + 7 days
      return deadlineDate;
    }
  }
  
  if (passedAt) {
    const expiryDate = new Date(passedAt);
    expiryDate.setDate(expiryDate.getDate() + 60); // 2 months after last pass
    expiryDate.setDate(expiryDate.getDate() + 7); // Plus 7 day grace period
    return expiryDate;
  }
  
  // Default: 7 days from now
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 7);
  return deadlineDate;
}

export function useCodeOfConductCompletion() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["code-of-conduct-completion", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;

      // Get employee ID from email
      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id, employment_start_date")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        return null;
      }

      if (!employee) return null;

      const { data, error } = await supabase
        .from("code_of_conduct_completions")
        .select("*")
        .eq("employee_id", employee.id)
        .maybeSingle();

      if (error) throw error;
      
      // If quiz is expired, return null to require retaking
      if (data && isQuizExpired(data.passed_at)) {
        return { ...data, isExpired: true };
      }
      
      return data ? { ...data, isExpired: false } : null;
    },
    enabled: !!user,
  });
}

// Get the current wrong questions from the latest incomplete attempt
export function useCodeOfConductCurrentAttempt() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["code-of-conduct-current-attempt", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;

      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        return null;
      }

      if (!employee) return null;

      // First check if there's a valid (non-expired) completion
      const { data: completion } = await supabase
        .from("code_of_conduct_completions")
        .select("passed_at")
        .eq("employee_id", employee.id)
        .maybeSingle();

      if (completion && !isQuizExpired(completion.passed_at)) {
        // Quiz is complete and not expired
        return null;
      }

      // Get the latest attempt for this cycle
      const { data: latestAttempt, error } = await supabase
        .from("code_of_conduct_attempts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("passed", false)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return latestAttempt;
    },
    enabled: !!user,
  });
}

interface SubmitCodeOfConductParams {
  answers: Record<number, string>;
  questionsToAnswer: number[]; // Which question IDs were displayed
}

export function useSubmitCodeOfConduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ answers, questionsToAnswer }: SubmitCodeOfConductParams) => {
      if (!user?.email) throw new Error("Not authenticated");

      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) throw new Error("Error finding employee");
      if (!employee) throw new Error("Employee not found");

      // Get IP address
      let ipAddress = "Unknown";
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP address");
      }

      const userAgent = navigator.userAgent;

      // Check which questions were wrong
      const wrongQuestionNumbers: number[] = [];
      for (const questionId of questionsToAnswer) {
        const question = CODE_OF_CONDUCT_QUESTIONS.find(q => q.id === questionId);
        if (question && answers[questionId] !== question.correctAnswer) {
          wrongQuestionNumbers.push(questionId);
        }
      }

      const passed = wrongQuestionNumbers.length === 0;

      // Get current attempt number
      const { data: previousAttempts } = await supabase
        .from("code_of_conduct_attempts")
        .select("attempt_number")
        .eq("employee_id", employee.id)
        .order("attempt_number", { ascending: false })
        .limit(1);

      const attemptNumber = (previousAttempts?.[0]?.attempt_number || 0) + 1;

      // Save attempt
      const { error: attemptError } = await supabase
        .from("code_of_conduct_attempts")
        .insert({
          employee_id: employee.id,
          attempt_number: attemptNumber,
          answers,
          wrong_question_numbers: wrongQuestionNumbers,
          passed,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      if (attemptError) throw attemptError;

      // If all questions correct, update/insert completion
      if (passed) {
        const { error: completionError } = await supabase
          .from("code_of_conduct_completions")
          .upsert({
            employee_id: employee.id,
            passed_at: new Date().toISOString(),
          }, {
            onConflict: "employee_id",
          });

        if (completionError) throw completionError;
      }

      return { passed, wrongQuestionNumbers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-completion"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-current-attempt"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-lock"] });
    },
  });
}

// Check if user should be locked out due to expired/missing Code of Conduct
// Note: No lock overlay for Code of Conduct - menu stays visible
export function useCodeOfConductLock() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["code-of-conduct-lock", user?.id],
    queryFn: async () => {
      if (!user?.email) return { isLocked: false, daysRemaining: null as number | null, isRequired: false };

      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id, job_title, employment_start_date")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .maybeSingle();

      if (employeeError) {
        console.error("Error fetching employee for lock check:", employeeError);
        return { isLocked: false, daysRemaining: null as number | null, isRequired: false };
      }

      if (!employee) return { isLocked: false, daysRemaining: null as number | null, isRequired: false };

      // Only applies to Salgskonsulent employees
      if (employee.job_title !== "Salgskonsulent") {
        return { isLocked: false, daysRemaining: null as number | null, isRequired: false };
      }

      // New employees get 14 days before quiz is required
      if (isWithinInitialGracePeriod(employee.employment_start_date)) {
        const startDate = new Date(employee.employment_start_date!);
        const daysSinceStart = differenceInDays(new Date(), startDate);
        const daysUntilRequired = 14 - daysSinceStart;
        return { 
          isLocked: false, 
          daysRemaining: daysUntilRequired,
          isRequired: false 
        };
      }

      // Check completion
      const { data: completion } = await supabase
        .from("code_of_conduct_completions")
        .select("passed_at")
        .eq("employee_id", employee.id)
        .maybeSingle();

      const hasValidCompletion = completion && !isQuizExpired(completion.passed_at);

      if (hasValidCompletion) {
        // Calculate days until renewal (2 months = 60 days)
        const passedDate = new Date(completion.passed_at);
        const daysSincePassed = differenceInDays(new Date(), passedDate);
        const daysUntilRenewal = 60 - daysSincePassed;
        
        return { 
          isLocked: false, 
          daysRemaining: daysUntilRenewal > 0 ? daysUntilRenewal : 0,
          isRequired: false 
        };
      }

      // Quiz is required - check deadline
      const deadlineDate = getDeadlineDate(completion?.passed_at || null, employee.employment_start_date);
      const now = new Date();
      const daysRemaining = differenceInDays(deadlineDate, now);

      // No lock for Code of Conduct - just mark as required
      return { isLocked: false, daysRemaining: Math.max(0, daysRemaining), isRequired: true };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  return {
    isLocked: false, // Never lock - menu always visible
    daysRemaining: data?.daysRemaining ?? null,
    isRequired: data?.isRequired ?? false,
    isLoading,
  };
}

// Hook to check if user should see the menu item
export function useIsSalgskonsulent() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-salgskonsulent", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking salgskonsulent status:", error);
        return false;
      }

      return data?.job_title === "Salgskonsulent";
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}
