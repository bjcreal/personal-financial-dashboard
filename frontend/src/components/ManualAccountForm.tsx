import { useState } from "react";
import { ACCOUNT_TYPES, AccountType } from "@/lib/accountTypes";
import { apiPost } from "@/lib/api";

interface ManualAccountFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ManualAccountForm({
  onSuccess,
  onCancel,
}: ManualAccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "depository" as AccountType,
    subtype: "checking",
    balance: "",
    url: "",
    metadata: {
      address: "",
      city: "",
      state: "",
      zipCode: "",
      purchasePrice: "",
      purchaseDate: "",
      propertyType: "single_family",
      squareFeet: "",
      yearBuilt: "",
    },
  });

  const accountTypes = Object.entries(ACCOUNT_TYPES).map(([value, type]) => ({
    value,
    label: type.label,
  }));

  const subtypes = {
    depository: ACCOUNT_TYPES.depository.subtypes,
    credit: ACCOUNT_TYPES.credit.subtypes,
    loan: ACCOUNT_TYPES.loan.subtypes,
    investment: ACCOUNT_TYPES.investment.subtypes,
    asset: ACCOUNT_TYPES.asset.subtypes,
    other: ACCOUNT_TYPES.other.subtypes,
  };

  const propertyTypes = [
    { value: "single_family", label: "Single Family" },
    { value: "multi_family", label: "Multi Family" },
    { value: "condo", label: "Condo" },
    { value: "townhouse", label: "Townhouse" },
    { value: "land", label: "Land" },
    { value: "commercial", label: "Commercial" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      ...formData,
      metadata:
        formData.type === "asset" && formData.subtype === "real_estate"
          ? JSON.stringify(formData.metadata)
          : null,
    };

    try {
      await apiPost("/api/accounts/manual", payload);
      onSuccess();
    } catch (error) {
      console.error("Error creating manual account:", error);
      alert("Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRealEstate =
    formData.type === "asset" && formData.subtype === "real_estate";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Account Name
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., Personal Checking"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Reference URL
        </label>
        <input
          type="url"
          value={formData.url}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, url: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., https://www.zillow.com/homedetails/..."
        />
        <p className="mt-1 text-sm text-gray-500">
          Optional: Link to external reference for this account&apos;s value
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Account Type
        </label>
        <select
          required
          value={formData.type}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              type: e.target.value as AccountType,
              subtype: subtypes[e.target.value as AccountType][0].value,
            }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {accountTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Subtype
        </label>
        <select
          required
          value={formData.subtype}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subtype: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {subtypes[formData.type].map((subtype) => (
            <option key={subtype.value} value={subtype.value}>
              {subtype.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Current Value
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            required
            step="0.01"
            value={formData.balance}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, balance: e.target.value }))
            }
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
      </div>

      {isRealEstate && (
        <div className="space-y-4 border-t pt-4 mt-4">
          <h3 className="font-medium text-gray-900">Property Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Street Address
              </label>
              <input
                type="text"
                required
                value={formData.metadata.address}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, address: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                type="text"
                required
                value={formData.metadata.city}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, city: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                State
              </label>
              <input
                type="text"
                required
                value={formData.metadata.state}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, state: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                ZIP Code
              </label>
              <input
                type="text"
                required
                value={formData.metadata.zipCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, zipCode: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Property Type
              </label>
              <select
                required
                value={formData.metadata.propertyType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      propertyType: e.target.value,
                    },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Square Feet
              </label>
              <input
                type="number"
                required
                value={formData.metadata.squareFeet}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, squareFeet: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Year Built
              </label>
              <input
                type="number"
                required
                value={formData.metadata.yearBuilt}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, yearBuilt: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purchase Price
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.metadata.purchasePrice}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        purchasePrice: e.target.value,
                      },
                    }))
                  }
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purchase Date
              </label>
              <input
                type="date"
                required
                value={formData.metadata.purchaseDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      purchaseDate: e.target.value,
                    },
                  }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : "Add Account"}
        </button>
      </div>
    </form>
  );
}
