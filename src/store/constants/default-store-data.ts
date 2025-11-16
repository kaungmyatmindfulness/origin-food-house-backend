// Re-export helper for backwards compatibility
export { toPrismaDecimal } from "../helpers/data-conversion.helper";

/**
 * Default categories created for new stores
 */
export interface DefaultCategory {
  name: string;
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Appetizers", sortOrder: 0 },
  { name: "Main Courses", sortOrder: 1 },
  { name: "Drinks", sortOrder: 2 },
];

/**
 * Default table names created for new stores
 */
export const DEFAULT_TABLE_NAMES: string[] = [
  "T-1",
  "T-2",
  "T-3",
  "T-4",
  "T-5",
];

/**
 * Default menu item definition
 */
export interface DefaultMenuItem {
  name: string;
  description: string;
  basePrice: string; // Use string for Prisma.Decimal conversion
  categoryName: string; // References category by name
  imageFileName: string | null; // Filename from assets/images/seed/menu (null = no image)
  preparationTimeMinutes: number;
  sortOrder: number;
  routingArea?: string; // Kitchen routing area
}

/**
 * Optimized default menu items - reduced to 6 items total (2 per category)
 * Images available: bread.jpg, chicken-curry.jpg, iced-latte.jpg, milk-tea.jpg,
 * pizza.jpg, vegetables-salad.jpg
 */
export const DEFAULT_MENU_ITEMS: DefaultMenuItem[] = [
  // Appetizers (2 items)
  {
    name: "Garden Fresh Salad",
    description:
      "Crisp mixed greens with fresh vegetables, cherry tomatoes, and house vinaigrette",
    basePrice: "7.99",
    categoryName: "Appetizers",
    imageFileName: "vegetables-salad.jpg",
    preparationTimeMinutes: 10,
    sortOrder: 0,
    routingArea: "SALAD",
  },
  {
    name: "Garlic Bread",
    description:
      "Toasted artisan bread with garlic butter and herbs, served warm",
    basePrice: "5.99",
    categoryName: "Appetizers",
    imageFileName: "bread.jpg",
    preparationTimeMinutes: 8,
    sortOrder: 1,
    routingArea: "GRILL",
  },

  // Main Courses (2 items)
  {
    name: "Thai Chicken Curry",
    description:
      "Aromatic Thai red curry with tender chicken, vegetables, and coconut milk",
    basePrice: "14.99",
    categoryName: "Main Courses",
    imageFileName: "chicken-curry.jpg",
    preparationTimeMinutes: 20,
    sortOrder: 0,
    routingArea: "GRILL",
  },
  {
    name: "Pizza Margherita",
    description:
      "Classic Italian pizza with tomato sauce, mozzarella, fresh basil, and olive oil",
    basePrice: "12.99",
    categoryName: "Main Courses",
    imageFileName: "pizza.jpg",
    preparationTimeMinutes: 18,
    sortOrder: 1,
    routingArea: "GRILL",
  },

  // Drinks (2 items)
  {
    name: "Iced Latte",
    description: "Smooth espresso with cold milk over ice, lightly sweetened",
    basePrice: "4.99",
    categoryName: "Drinks",
    imageFileName: "iced-latte.jpg",
    preparationTimeMinutes: 5,
    sortOrder: 0,
    routingArea: "DRINKS",
  },
  {
    name: "Thai Milk Tea",
    description: "Creamy Thai tea with condensed milk, served over ice",
    basePrice: "4.49",
    categoryName: "Drinks",
    imageFileName: "milk-tea.jpg",
    preparationTimeMinutes: 5,
    sortOrder: 1,
    routingArea: "DRINKS",
  },
];

/**
 * Default customization group definition
 */
export interface DefaultCustomizationGroup {
  name: string;
  minSelectable: number;
  maxSelectable: number;
  options: DefaultCustomizationOption[];
}

export interface DefaultCustomizationOption {
  name: string;
  additionalPrice: string | null; // Use string for Prisma.Decimal conversion
  sortOrder: number;
}

/**
 * Customization group templates that can be applied to menu items
 */
export const CUSTOMIZATION_TEMPLATES = {
  SIZE: {
    name: "Size",
    minSelectable: 1,
    maxSelectable: 1,
    options: [
      { name: "Small", additionalPrice: null, sortOrder: 0 },
      { name: "Medium", additionalPrice: "2.00", sortOrder: 1 },
      { name: "Large", additionalPrice: "4.00", sortOrder: 2 },
    ],
  } as DefaultCustomizationGroup,

  SPICE_LEVEL: {
    name: "Spice Level",
    minSelectable: 0,
    maxSelectable: 1,
    options: [
      { name: "Mild", additionalPrice: null, sortOrder: 0 },
      { name: "Medium", additionalPrice: null, sortOrder: 1 },
      { name: "Hot", additionalPrice: null, sortOrder: 2 },
      { name: "Extra Hot", additionalPrice: null, sortOrder: 3 },
    ],
  } as DefaultCustomizationGroup,

  ADD_ONS: {
    name: "Add Ons",
    minSelectable: 0,
    maxSelectable: 3,
    options: [
      { name: "Extra Cheese", additionalPrice: "1.50", sortOrder: 0 },
      { name: "Bacon", additionalPrice: "2.00", sortOrder: 1 },
      { name: "Avocado", additionalPrice: "2.50", sortOrder: 2 },
      { name: "Extra Vegetables", additionalPrice: "1.00", sortOrder: 3 },
      { name: "Extra Protein", additionalPrice: "3.00", sortOrder: 4 },
    ],
  } as DefaultCustomizationGroup,

  TEMPERATURE: {
    name: "Temperature",
    minSelectable: 1,
    maxSelectable: 1,
    options: [
      { name: "Hot", additionalPrice: null, sortOrder: 0 },
      { name: "Iced", additionalPrice: null, sortOrder: 1 },
    ],
  } as DefaultCustomizationGroup,
};

/**
 * Mapping of menu items to their customization groups
 * Key is menu item name, value is array of customization template keys
 */
export const MENU_ITEM_CUSTOMIZATIONS: Record<string, string[]> = {
  // Main courses
  "Thai Chicken Curry": ["SPICE_LEVEL", "ADD_ONS"],
  "Pizza Margherita": ["SIZE", "ADD_ONS"],

  // Drinks
  "Iced Latte": ["SIZE", "TEMPERATURE"],
  "Thai Milk Tea": ["SIZE", "TEMPERATURE"],
};
