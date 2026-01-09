import { FormResult } from "@/components/league/FormIndicator";

// Extended interface for mock data with gamification fields
export interface MockQualificationStanding {
  id: string;
  season_id: string;
  employee_id: string;
  current_provision: number;
  deals_count: number;
  projected_division: number;
  projected_rank: number;
  overall_rank: number;
  previous_overall_rank: number | null;
  last_calculated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  // Gamification fields
  weekly_change: number;
  avg_per_deal: number;
  recent_form: FormResult[];
}

const FIRST_NAMES = [
  "Anders", "Kasper", "Mikkel", "Frederik", "Christian", "Thomas", "Martin", "Jonas", "Mads", "Nicolai",
  "Sofie", "Emma", "Julie", "Anna", "Laura", "Ida", "Cecilie", "Maria", "Louise", "Mathilde",
  "Oliver", "William", "Noah", "Oscar", "Lucas", "Victor", "Emil", "Sebastian", "Benjamin", "Alexander",
  "Freja", "Maja", "Clara", "Isabella", "Sofia", "Alma", "Ella", "Karla", "Victoria", "Nadia"
];

const LAST_NAMES = [
  "Jensen", "Nielsen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sørensen", "Rasmussen", "Jørgensen",
  "Petersen", "Madsen", "Kristensen", "Olsen", "Thomsen", "Poulsen", "Johansen", "Knudsen", "Mortensen", "Møller"
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomForm(): FormResult[] {
  const results: FormResult[] = [];
  for (let i = 0; i < 5; i++) {
    const rand = Math.random();
    if (rand < 0.45) {
      results.push("win");
    } else if (rand < 0.75) {
      results.push("loss");
    } else {
      results.push("draw");
    }
  }
  return results;
}

export interface MockStandingsOptions {
  playerCount: number;
  playersPerDivision: number;
  includeRankChanges?: boolean;
  currentEmployeeIndex?: number;
  minProvision?: number;
  maxProvision?: number;
}

export function generateMockStandings(options: MockStandingsOptions): MockQualificationStanding[] {
  const {
    playerCount,
    playersPerDivision,
    includeRankChanges = true,
    currentEmployeeIndex = Math.floor(playerCount / 2),
    minProvision = 5000,
    maxProvision = 120000
  } = options;

  const standings: MockQualificationStanding[] = [];

  // Generate players with random provision
  for (let i = 0; i < playerCount; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    
    // Higher provision for lower indexes (to create realistic distribution)
    const provisionBase = maxProvision - (i / playerCount) * (maxProvision - minProvision);
    const provision = Math.round(provisionBase * (0.8 + Math.random() * 0.4));
    const deals = randomInt(5, 50);
    const avgPerDeal = deals > 0 ? Math.round(provision / deals) : 0;
    
    // Weekly change - higher ranked players tend to have positive change
    const changeBase = (playerCount - i) / playerCount;
    const weeklyChange = Math.round((changeBase - 0.5) * 20000 * (0.5 + Math.random()));
    
    standings.push({
      id: `mock-${i}`,
      season_id: "test-season-id",
      employee_id: `emp-${i}`,
      current_provision: provision,
      deals_count: deals,
      projected_division: 0, // Will be calculated
      projected_rank: 0, // Will be calculated
      overall_rank: 0, // Will be calculated
      previous_overall_rank: includeRankChanges ? randomInt(1, playerCount) : null,
      last_calculated_at: new Date().toISOString(),
      employee: {
        id: `emp-${i}`,
        first_name: firstName,
        last_name: lastName
      },
      weekly_change: weeklyChange,
      avg_per_deal: avgPerDeal,
      recent_form: generateRandomForm()
    });
  }

  // Sort by provision (highest first)
  standings.sort((a, b) => b.current_provision - a.current_provision);

  // Calculate ranks and divisions
  standings.forEach((standing, index) => {
    standing.overall_rank = index + 1;
    standing.projected_division = Math.floor(index / playersPerDivision) + 1;
    standing.projected_rank = (index % playersPerDivision) + 1;
  });

  return standings;
}

export function getCurrentEmployeeId(standings: MockQualificationStanding[], index: number): string | null {
  if (index >= 0 && index < standings.length) {
    return standings[index].employee_id;
  }
  return null;
}
