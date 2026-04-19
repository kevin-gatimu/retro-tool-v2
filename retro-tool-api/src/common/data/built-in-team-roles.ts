export interface BuiltInTeamRole {
  name: string;
  sortOrder: number;
}

export const BUILT_IN_TEAM_ROLES: BuiltInTeamRole[] = [
  { name: 'Tech Lead', sortOrder: 1 },
  { name: 'Data Engineer', sortOrder: 2 },
  { name: 'Project Manager', sortOrder: 3 },
  { name: 'Business Analyst', sortOrder: 4 },
  { name: 'Senior Business Analyst', sortOrder: 5 },
  { name: 'Senior Developer', sortOrder: 6 },
  { name: 'QA/Scrum Master', sortOrder: 7 },
  { name: 'QE/Scrum Master', sortOrder: 8 },
  { name: 'Salesforce System Admin', sortOrder: 9 },
  { name: 'Salesforce Developer', sortOrder: 10 },
  { name: 'Data Analyst', sortOrder: 11 },
  { name: 'Developer', sortOrder: 12 },
  { name: 'QA', sortOrder: 13 },
  { name: 'QE', sortOrder: 14 },
  { name: 'QA/QE', sortOrder: 15 },
  { name: 'DevOps', sortOrder: 16 },
  { name: 'BI-Dev', sortOrder: 17 },
  { name: 'Oversight', sortOrder: 18 },
];
