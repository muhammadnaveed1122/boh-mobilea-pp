/**
 * Project-management detail models. Mirror the web `Project` / `PaymentPlan` /
 * `Segment` / `UnitType` / `Layout` shapes (boh-lead-magnet
 * features/projects/models) but trimmed to the fields the mobile detail screen
 * renders. All come from the same NestJS endpoints under `/api/v1/projects`.
 */
export interface ProjectDeveloper {
  readonly id: string;
  readonly brandName: string;
  readonly logoUrl: string | null;
}

export interface ProjectOperationsManager {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
}

export interface PermitDocument {
  readonly id: string;
  readonly documentName: string;
  readonly documentUrl: string;
  readonly createdAt: string;
}

export interface Project {
  readonly id: string;
  readonly projectName: string;
  readonly developer: ProjectDeveloper | null;
  readonly operationsManager: ProjectOperationsManager | null;
  readonly availability: string | null;
  readonly status: string | null;
  readonly trakheesiPermitStatus: string | null;
  readonly trakheesiQrCodeUrl: string | null;
  readonly developmentStage: string | null;
  readonly neighbourhoodName: string | null;
  readonly stateName: string | null;
  readonly propertyUse: string | null;
  readonly handoverDate: string | null;
  readonly lifestyleStandard: string | null;
  readonly shortDescription: string | null;
  readonly heroImageUrls: string[];
  // Compliance & permits
  readonly reraProjectNumber: string | null;
  readonly dldPermitReference: string | null;
  readonly dldPermitStatus: string | null;
  readonly permitDocuments: PermitDocument[];
  // Commercial
  readonly commissionModel: string | null;
  readonly defaultCommissionPercent: number | null;
  readonly reservationFee: number | null;
  readonly startingPrice: number | null;
  readonly updatedAt: string;
}

export interface PaymentPlanMilestone {
  readonly id: string;
  readonly name: string;
  readonly percentage: number;
  readonly amount: number | null;
  readonly date: string | null;
  readonly displayOrder: number;
}

export interface PaymentPlan {
  readonly id: string;
  readonly planName: string;
  readonly status: 'draft' | 'active';
  readonly totalPercentage: number;
  readonly milestones: PaymentPlanMilestone[];
}

export interface Segment {
  readonly id: string;
  readonly name: string;
  readonly viewType: string | null;
  readonly floorsMin: number;
  readonly floorsMax: number;
  readonly completionStage: string | null;
  readonly expectedHandover: string | null;
  readonly status: string;
}

export interface UnitLayout {
  readonly id: string;
  readonly name: string;
  readonly viewType: string | null;
  readonly size: number | null;
  readonly price: number | null;
  readonly currency: string | null;
  /** Floor-plan preview image (thumbnail). Null when only a PDF exists. */
  readonly previewImageUrl: string | null;
  readonly previewImageAltText: string | null;
  /** Floor-plan PDF (no inline preview on mobile — opened externally). */
  readonly floorPlanPdfUrl: string | null;
}

export interface UnitType {
  readonly id: string;
  readonly segmentName: string;
  readonly propertyUse: string | null;
  readonly propertyType: string | null;
  readonly unitType: string;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly sizeMin: number | null;
  readonly sizeMax: number | null;
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly currency: string | null;
  readonly layouts: UnitLayout[];
}
