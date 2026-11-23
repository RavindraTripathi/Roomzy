import React, { useMemo, useState } from 'react';
import { APIProvider, AdvancedMarker, InfoWindow, Map as GoogleMap, Pin } from '@vis.gl/react-google-maps';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Building2,
  Edit3,
  MapPin,
  MessageSquare,
  Plus,
  Power,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatINR } from '../lib/compatibility';
import { AMENITY_OPTIONS, INDIAN_CITIES, PropertyListing } from '../types/roomzy';

interface RoomsMarketplaceProps {
  currentUid: string | null;
  currentUserName: string;
  currentUserVerified: boolean;
  listings: PropertyListing[];
  mapsApiKey: string;
  onContactOwner: (listing: PropertyListing) => void;
  onBoostListing: (listing: PropertyListing) => void;
  onRequireAuth: () => void;
}

export const RoomsMarketplace: React.FC<RoomsMarketplaceProps> = ({
  currentUid,
  currentUserName,
  currentUserVerified,
  listings,
  mapsApiKey,
  onContactOwner,
  onBoostListing,
  onRequireAuth,
}) => {
  const [cityFilter, setCityFilter] = useState('All');
  const [maxRent, setMaxRent] = useState(60000);
  const [furnishingFilter, setFurnishingFilter] = useState('All');
  const [tenantFilter, setTenantFilter] = useState('All');
  const [searchLocality, setSearchLocality] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Listing form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [locality, setLocality] = useState('Indiranagar');
  const [monthlyRent, setMonthlyRent] = useState(18000);
  const [securityDeposit, setSecurityDeposit] = useState(50000);
  const [maintenanceCharges, setMaintenanceCharges] = useState(2000);
  const [availableRooms, setAvailableRooms] = useState(1);
  const [furnishing, setFurnishing] = useState<'Fully Furnished' | 'Semi-Furnished' | 'Unfurnished'>('Fully Furnished');
  const [preferredTenant, setPreferredTenant] = useState<PropertyListing['preferredTenant']>('Any');
  const [availableFrom, setAvailableFrom] = useState(new Date().toISOString().slice(0, 10));
  const [amenities, setAmenities] = useState<string[]>(['High-Speed Wi-Fi', 'Washing Machine']);
  const [imageUrl, setImageUrl] = useState('/src/assets/images/room_master_bedroom_1795424076459.jpg');

  const filtered = useMemo(() => {
    return listings
      .filter((l) => {
        if (showMineOnly) {
          return l.ownerUid === currentUid;
        }
        if (l.status !== 'active') return false;
        if (cityFilter !== 'All' && l.city !== cityFilter) return false;
        if (l.monthlyRent > maxRent) return false;
        if (furnishingFilter !== 'All' && l.furnishing !== furnishingFilter) return false;
        if (tenantFilter !== 'All' && l.preferredTenant !== tenantFilter) return false;
        if (
          searchLocality.trim() &&
          !l.locality.toLowerCase().includes(searchLocality.trim().toLowerCase()) &&
          !l.title.toLowerCase().includes(searchLocality.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));
  }, [listings, showMineOnly, currentUid, cityFilter, maxRent, furnishingFilter, tenantFilter, searchLocality]);

  const mapCenter = useMemo(() => {
    if (cityFilter !== 'All') {
      const found = INDIAN_CITIES.find((c) => c.name === cityFilter);
      if (found) return found.center;
    }
    return { lat: 12.9716, lng: 77.5946 };
  }, [cityFilter]);

  const openCreateModal = () => {
    if (!currentUid) {
      onRequireAuth();
      return;
    }
    setEditing(null);
    setTitle('');
    setDescription('');
    setCity('Bangalore');
    setLocality('Indiranagar');
    setMonthlyRent(18000);
    setSecurityDeposit(50000);
    setMaintenanceCharges(2000);
    setAvailableRooms(1);
    setFurnishing('Fully Furnished');
    setPreferredTenant('Any');
    setAvailableFrom(new Date().toISOString().slice(0, 10));
    setAmenities(['High-Speed Wi-Fi', 'Washing Machine']);
    setImageUrl('/src/assets/images/room_master_bedroom_1795424076459.jpg');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (listing: PropertyListing) => {
    setEditing(listing);
    setTitle(listing.title);
    setDescription(listing.description);
    setCity(listing.city);
    setLocality(listing.locality);
    setMonthlyRent(listing.monthlyRent);
    setSecurityDeposit(listing.securityDeposit);
    setMaintenanceCharges(listing.maintenanceCharges);
    setAvailableRooms(listing.availableRooms);
    setFurnishing(listing.furnishing);
    setPreferredTenant(listing.preferredTenant);
    setAvailableFrom(listing.availableFrom);
    setAmenities(listing.amenities || []);
    setImageUrl(listing.images?.[0] || '/src/assets/images/room_master_bedroom_1795424076459.jpg');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid) return;
    if (title.trim().length < 5) {
      setFormError('Title must be at least 5 characters.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const cityMeta = INDIAN_CITIES.find((c) => c.name === city) || INDIAN_CITIES[0];
    const jitterLat = ((title.length % 7) - 3) * 0.008;
    const jitterLng = ((locality.length % 7) - 3) * 0.008;

    try {
      if (editing?.id) {
        await updateDoc(doc(db, 'property_listings', editing.id), {
          ownerName: currentUserName,
          title: title.trim(),
          description: description.trim(),
          city,
          locality: locality.trim(),
          lat: editing.lat ?? cityMeta.center.lat + jitterLat,
          lng: editing.lng ?? cityMeta.center.lng + jitterLng,
          monthlyRent: Number(monthlyRent),
          securityDeposit: Number(securityDeposit),
          maintenanceCharges: Number(maintenanceCharges),
          availableRooms: Number(availableRooms),
          furnishing,
          amenities: amenities.slice(0, 12),
          preferredTenant,
          availableFrom,
          images: imageUrl.trim() ? [imageUrl.trim()] : [],
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'property_listings'), {
          ownerUid: currentUid,
          ownerName: currentUserName,
          ownerVerified: currentUserVerified,
          title: title.trim(),
          description: description.trim(),
          city,
          locality: locality.trim(),
          lat: cityMeta.center.lat + jitterLat,
          lng: cityMeta.center.lng + jitterLng,
          monthlyRent: Number(monthlyRent),
          securityDeposit: Number(securityDeposit),
          maintenanceCharges: Number(maintenanceCharges),
          availableRooms: Number(availableRooms),
          furnishing,
          amenities: amenities.slice(0, 12),
          preferredTenant,
          availableFrom,
          images: imageUrl.trim() ? [imageUrl.trim()] : [],
          isFeatured: false,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save listing.');
      handleFirestoreError(err, OperationType.WRITE, 'property_listings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (listing: PropertyListing) => {
    if (!listing.id) return;
    try {
      await updateDoc(doc(db, 'property_listings', listing.id), {
        status: listing.status === 'active' ? 'inactive' : 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `property_listings/${listing.id}`);
    }
  };

  const handleDelete = async (listing: PropertyListing) => {
    if (!listing.id) return;
    try {
      await deleteDoc(doc(db, 'property_listings', listing.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `property_listings/${listing.id}`);
    }
  };

  const selectedListing = filtered.find((l) => l.id === selectedListingId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms & Shared Apartments</h1>
          <p className="text-sm text-slate-600">
            Direct owner & flatmate listings across 10 Indian metro cities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUid && (
            <button
              type="button"
              onClick={() => setShowMineOnly((v) => !v)}
              className={`h-10 px-3.5 rounded-xl border text-xs font-semibold transition-colors ${
                showMineOnly
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              My Listings
            </button>
          )}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Map
            </button>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-10 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Post a Room
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          value={searchLocality}
          onChange={(e) => setSearchLocality(e.target.value)}
          placeholder="Search locality or title..."
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
        />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="All">All Cities</option>
          {INDIAN_CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={furnishingFilter}
          onChange={(e) => setFurnishingFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="All">Any Furnishing</option>
          <option value="Fully Furnished">Fully Furnished</option>
          <option value="Semi-Furnished">Semi-Furnished</option>
          <option value="Unfurnished">Unfurnished</option>
        </select>
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
        >
          <option value="All">Any Preferred Tenant</option>
          <option value="Male Only">Male Only</option>
          <option value="Female Only">Female Only</option>
          <option value="Working Professionals">Working Professionals</option>
          <option value="Students">Students</option>
        </select>
        <div className="flex flex-col justify-center">
          <div className="flex justify-between text-[11px] text-slate-600 mb-1">
            <span>Max Rent</span>
            <span className="font-mono-num font-bold text-slate-900">{formatINR(maxRent)}</span>
          </div>
          <input
            type="range"
            min={5000}
            max={80000}
            step={1000}
            value={maxRent}
            onChange={(e) => setMaxRent(Number(e.target.value))}
            className="w-full accent-violet-700"
          />
        </div>
      </div>

      {/* Interactive Map View */}
      {viewMode === 'map' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {mapsApiKey ? (
            <div className="h-[420px] w-full">
              <APIProvider apiKey={mapsApiKey} language="en" region="IN">
                <GoogleMap
                  defaultCenter={mapCenter}
                  defaultZoom={12}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling="greedy"
                  style={{ width: '100%', height: '100%' }}
                >
                  {filtered.map((item) => {
                    if (!item.lat || !item.lng) return null;
                    return (
                      <AdvancedMarker
                        key={item.id}
                        position={{ lat: item.lat, lng: item.lng }}
                        onClick={() => setSelectedListingId(item.id || null)}
                      >
                        <Pin background="#6d28d9" borderColor="#4c1d95" glyphColor="#ffffff" />
                      </AdvancedMarker>
                    );
                  })}

                  {selectedListing && selectedListing.lat && selectedListing.lng && (
                    <InfoWindow
                      position={{ lat: selectedListing.lat, lng: selectedListing.lng }}
                      onCloseClick={() => setSelectedListingId(null)}
                    >
                      <div className="p-1 max-w-[220px]">
                        <div className="text-xs font-bold text-slate-900">{selectedListing.title}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {selectedListing.locality}, {selectedListing.city}
                        </div>
                        <div className="text-xs font-bold text-violet-700 font-mono-num mt-1">
                          {formatINR(selectedListing.monthlyRent)}/mo
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            </div>
          ) : (
            <div className="p-8 text-center space-y-2 bg-slate-50">
              <MapPin className="w-8 h-8 text-violet-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Google Maps API Key Required for Live Map</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Add <code className="font-mono bg-white px-1.5 py-0.5 rounded border">VITE_GOOGLE_MAPS_API_KEY</code> to your environment secrets to render interactive Google Maps pins. Showing {filtered.length} matching properties in list view below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Listings Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No rooms match these filters</h3>
          <p className="text-sm text-slate-600 mt-1">
            Be the first to post an available room in this locality or widen your search filters.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 h-10 px-4 rounded-xl bg-violet-700 text-white text-xs font-semibold"
          >
            Post Available Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const isOwner = item.ownerUid === currentUid;
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {item.images?.[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Building2 className="w-10 h-10" />
                      </div>
                    )}
                    {item.isFeatured && (
                      <div className="absolute top-3 left-3 bg-violet-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                        Featured Listing
                      </div>
                    )}
                    {item.status !== 'active' && (
                      <div className="absolute top-3 right-3 bg-slate-900/85 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                        {item.status}
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-2.5">
                    <div className="text-xs text-slate-500">
                      {item.locality}, {item.city} · {item.furnishing}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-extrabold text-violet-700 font-mono-num">
                        {formatINR(item.monthlyRent)}
                        <span className="text-xs font-normal text-slate-500">/mo</span>
                      </span>
                      <span className="text-xs text-slate-500 font-mono-num">
                        Deposit {formatINR(item.securityDeposit)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 pt-1">
                      {item.availableRooms} room{item.availableRooms > 1 ? 's' : ''} · {item.preferredTenant} · From {item.availableFrom}
                    </div>
                    {item.amenities?.length > 0 && (
                      <div className="text-xs text-slate-500 line-clamp-1">
                        {item.amenities.slice(0, 4).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isOwner ? (
                    <div className="flex items-center gap-2 w-full justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(item)}
                          className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 inline-flex items-center gap-1"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {item.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          aria-label="Delete listing"
                          className="h-9 px-2.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!item.isFeatured && (
                        <button
                          type="button"
                          onClick={() => onBoostListing(item)}
                          className="h-9 px-3 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Boost
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-slate-600 truncate">
                        Posted by {item.ownerName}
                      </span>
                      <button
                        type="button"
                        onClick={() => (currentUid ? onContactOwner(item) : onRequireAuth())}
                        className="h-10 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Contact Owner
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Listing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editing ? 'Edit Property Listing' : 'Post Available Room or Flat'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveListing} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Property Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sunlit Private Room in 3BHK gated society"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      const found = INDIAN_CITIES.find((c) => c.name === e.target.value);
                      if (found) setLocality(found.localities[0]);
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {INDIAN_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Locality *</label>
                  <input
                    type="text"
                    required
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min={1500}
                    required
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Maintenance (₹)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={maintenanceCharges}
                    onChange={(e) => setMaintenanceCharges(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Available Rooms</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={availableRooms}
                    onChange={(e) => setAvailableRooms(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Furnishing</label>
                  <select
                    value={furnishing}
                    onChange={(e) => setFurnishing(e.target.value as PropertyListing['furnishing'])}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="Fully Furnished">Fully Furnished</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                    <option value="Unfurnished">Unfurnished</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Tenant</label>
                  <select
                    value={preferredTenant}
                    onChange={(e) => setPreferredTenant(e.target.value as PropertyListing['preferredTenant'])}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="Any">Any</option>
                    <option value="Male Only">Male Only</option>
                    <option value="Female Only">Female Only</option>
                    <option value="Working Professionals">Working Professionals</option>
                    <option value="Students">Students</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Available From</label>
                  <input
                    type="date"
                    required
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Property Image URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Amenities</label>
                <div className="flex flex-wrap gap-1.5">
                  {AMENITY_OPTIONS.map((a) => {
                    const active = amenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() =>
                          setAmenities((prev) =>
                            active ? prev.filter((x) => x !== a) : [...prev, a].slice(0, 12)
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          active
                            ? 'bg-violet-700 text-white border-violet-700'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Distance to metro/tech park, flatmate rules, cook/maid split..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
