import type { TIcebreakerFlavour } from '../../common/enums';

export interface IcebreakerTemplateWithPrompts {
  id: string;
  name: string;
  description: string | null;
  flavour: TIcebreakerFlavour;
  isBuiltIn: boolean;
  organizationId: string | null;
  organizationName: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  prompts: {
    id: string;
    templateId: string;
    text: string;
    order: number;
    color: string | null;
  }[];
}
