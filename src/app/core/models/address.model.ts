/** Backend CreateAddressDto */
export interface CreateAddressDto {
  label: string;
  country: string;
  city: string;
  state: string;
  block: string;
  street: string;
  avenue?: string | null;
  building_number: string;
  apartment_number?: string | null;
  is_default?: boolean;
}

/** Address as returned by API */
export interface Address {
  id: string;
  label?: string;
  country?: string;
  city?: string;
  state?: string;
  block?: string;
  street?: string;
  avenue?: string | null;
  building_number?: string;
  apartment_number?: string | null;
  is_default?: boolean;
  [key: string]: unknown;
}

export function formatAddressLine(a: Address): string {
  const parts = [
    a.building_number,
    a.apartment_number ? ` Apt ${a.apartment_number}` : '',
    a.street,
    a.avenue ? `, ${a.avenue}` : '',
    a.block ? ` Block ${a.block}` : '',
    a.state,
    a.city,
    a.country,
  ].filter(Boolean);
  return parts.join(', ') || a.label || '—';
}
