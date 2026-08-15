export type VendorCardData = {
  name: string;
  image: string;
  rating: number;
  reviews: number;
  distance: string;
  deliveryTime: string;
  category: string;
};

export const sampleVendors: VendorCardData[] = [
  {
    name: "Buka & Flame",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.8,
    reviews: 256,
    distance: "1.2 km",
    deliveryTime: "40 mins",
    category: "Jollof",
  },
  {
    name: "Pepper Pot Express",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.6,
    reviews: 189,
    distance: "2.4 km",
    deliveryTime: "35 mins",
    category: "Soups",
  },
  {
    name: "Morning Chop Spot",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.9,
    reviews: 342,
    distance: "0.9 km",
    deliveryTime: "25 mins",
    category: "Breakfast",
  },
  {
    name: "Midnight Grill Cart",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop",
    rating: 4.5,
    reviews: 127,
    distance: "3.1 km",
    deliveryTime: "45 mins",
    category: "Grill",
  },
];
