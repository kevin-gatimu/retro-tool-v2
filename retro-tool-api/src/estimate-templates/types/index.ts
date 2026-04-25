export interface EstimateTemplateWithValues {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  organizationId: string | null;
  organizationName: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  values: {
    id: string;
    templateId: string;
    label: string;
    value: string;
    order: number;
    color: string | null;
    description: string | null;
  }[];
}
