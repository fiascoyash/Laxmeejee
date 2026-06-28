import { QuotationTemplate, A4_WIDTH, A4_HEIGHT, CompanyProfile, TemplateCategory } from '../types';
import { Check, Layout, Star, ChevronRight, Crown, Sparkles } from 'lucide-react';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  professional: 'Professional',
  gst: 'GST Focused',
  retail: 'Retail',
  modern: 'Modern',
  luxury: 'Luxury',
  specialty: 'Specialty',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  professional: 'bg-gray-100 text-gray-700',
  gst: 'bg-green-100 text-green-700',
  retail: 'bg-orange-100 text-orange-700',
  modern: 'bg-blue-100 text-blue-700',
  luxury: 'bg-amber-100 text-amber-700',
  specialty: 'bg-purple-100 text-purple-700',
};

interface Props {
  templates: QuotationTemplate[];
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
  onContinue: () => void;
  onManageTemplates: () => void;
  companyProfile: CompanyProfile;
}

const MM_TO_PX = 3.7795275591;

export function TemplateSelection({
  templates,
  selectedTemplateId,
  onSelect,
  onContinue,
  onManageTemplates,
  companyProfile,
}: Props) {

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Quotation Template</h2>
        <p className="text-gray-500">Choose a template design for your quotation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            isDefault={template.isDefault || false}
            companyProfile={companyProfile}
            onClick={() => onSelect(template.id)}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Layout className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">No templates available</p>
          <button
            onClick={onManageTemplates}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Template
          </button>
        </div>
      )}

      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={onManageTemplates}
          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Manage Templates <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={onContinue}
          disabled={!selectedTemplateId}
          className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 ${
            selectedTemplateId
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue to Create Quotation
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isSelected,
  isDefault,
  companyProfile,
  onClick,
}: {
  template: QuotationTemplate;
  isSelected: boolean;
  isDefault: boolean;
  companyProfile: CompanyProfile;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : template.isPremium ? 'border-amber-300 hover:border-amber-400' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Category badge */}
      {template.category && (
        <div className="absolute top-2 left-2 flex gap-1">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${CATEGORY_COLORS[template.category]}`}>
            {CATEGORY_LABELS[template.category]}
          </span>
          {template.isPremium && (
            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-500 text-white flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Premium
            </span>
          )}
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Default badge */}
      {isDefault && !isSelected && !template.isPremium && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" /> Default
        </div>
      )}

      {/* Mini preview */}
      <div className={`h-32 rounded-lg mb-3 overflow-hidden relative ${
        template.isPremium ? 'bg-gradient-to-br from-amber-50 to-yellow-50' : 'bg-gray-50'
      }`}>
        <div
          className="bg-white shadow-sm absolute transform origin-top-left scale-[0.4]"
          style={{
            width: A4_WIDTH * MM_TO_PX,
            height: A4_HEIGHT * MM_TO_PX,
          }}
        >
          {(template.blocks || []).filter(b => b.visible).map(block => (
            <div
              key={block.id}
              className="absolute overflow-hidden"
              style={{
                left: block.x * MM_TO_PX,
                top: block.y * MM_TO_PX,
                width: block.width * MM_TO_PX,
                height: block.height * MM_TO_PX,
              }}
            >
              {block.type === 'company_logo' && companyProfile.logo && (
                <div className="w-full h-full bg-gray-200" />
              )}
              {block.type === 'company_details' && (
                <div className="text-sm font-bold">{companyProfile.companyName || 'Company'}</div>
              )}
              {block.type === 'quotation_number' && (
                <div className="text-xs font-semibold">QT-2024-0001</div>
              )}
              {block.type === 'customer_details' && (
                <div className="text-xs">Customer Name</div>
              )}
              {block.type === 'product_table' && (
                <div className="w-full h-full bg-gray-100 text-xs p-0.5">Table</div>
              )}
              {block.type === 'totals' && (
                <div className="text-xs text-right">Total</div>
              )}
              {(block.type === 'bank_details' || block.type === 'terms_conditions') && (
                <div className="text-xs text-gray-500">{block.type === 'bank_details' ? 'Bank' : 'Terms'}</div>
              )}
              {block.type === 'signature_box' && (
                <div className="border-t border-gray-400 mt-auto text-xs text-center">Sign</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Template info */}
      <h3 className="font-semibold text-gray-800 truncate">{template.name}</h3>
      {template.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{template.description}</p>
      )}

      <div className="mt-2 text-xs text-gray-400">
        {(template.blocks || []).length} blocks
      </div>
    </button>
  );
}
