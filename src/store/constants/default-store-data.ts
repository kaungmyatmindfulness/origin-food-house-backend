import { Prisma } from "@prisma/client";

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
  { name: "Desserts", sortOrder: 3 },
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
 * Default menu items mapped to available images
 * Images available: bread.jpg, chicken-curry.jpg, iced-latte.jpg, milk-tea.jpg,
 * pizza.jpg, ramen-noodle.jpg, salmon-sushi.jpg, strawberry-drink.jpg,
 * suki.jpg, vegetables-salad.jpg
 */
export const DEFAULT_MENU_ITEMS: DefaultMenuItem[] = [
  // Appetizers (3 items)
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
  {
    name: "Spring Rolls",
    description: "Crispy vegetable spring rolls with sweet chili dipping sauce",
    basePrice: "6.99",
    categoryName: "Appetizers",
    imageFileName: null, // No image available
    preparationTimeMinutes: 12,
    sortOrder: 2,
    routingArea: "FRY",
  },

  // Main Courses (5 items)
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
  {
    name: "Ramen Noodle Bowl",
    description:
      "Rich tonkotsu broth with ramen noodles, pork belly, soft-boiled egg, and green onions",
    basePrice: "13.99",
    categoryName: "Main Courses",
    imageFileName: "ramen-noodle.jpg",
    preparationTimeMinutes: 25,
    sortOrder: 2,
    routingArea: "GRILL",
  },
  {
    name: "Salmon Sushi Platter",
    description:
      "Fresh salmon nigiri and rolls with wasabi, ginger, and soy sauce",
    basePrice: "16.99",
    categoryName: "Main Courses",
    imageFileName: "salmon-sushi.jpg",
    preparationTimeMinutes: 15,
    sortOrder: 3,
    routingArea: "SALAD",
  },
  {
    name: "Suki Hot Pot",
    description:
      "Thai-style hot pot with meat, seafood, vegetables, and glass noodles in savory broth",
    basePrice: "15.99",
    categoryName: "Main Courses",
    imageFileName: "suki.jpg",
    preparationTimeMinutes: 22,
    sortOrder: 4,
    routingArea: "GRILL",
  },

  // Drinks (4 items)
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
  {
    name: "Strawberry Smoothie",
    description:
      "Fresh strawberries blended with yogurt, honey, and ice. Refreshing and healthy!",
    basePrice: "5.49",
    categoryName: "Drinks",
    imageFileName: "strawberry-drink.jpg",
    preparationTimeMinutes: 5,
    sortOrder: 2,
    routingArea: "DRINKS",
  },
  {
    name: "Fresh Orange Juice",
    description: "Freshly squeezed orange juice, no added sugar",
    basePrice: "3.99",
    categoryName: "Drinks",
    imageFileName: null, // No image available
    preparationTimeMinutes: 5,
    sortOrder: 3,
    routingArea: "DRINKS",
  },

  // Desserts (3 items)
  {
    name: "Chocolate Lava Cake",
    description:
      "Warm chocolate cake with molten center, served with vanilla ice cream",
    basePrice: "6.99",
    categoryName: "Desserts",
    imageFileName: null, // No image available
    preparationTimeMinutes: 12,
    sortOrder: 0,
    routingArea: "GRILL",
  },
  {
    name: "Ice Cream Sundae",
    description:
      "Three scoops of ice cream with chocolate sauce, whipped cream, and cherry",
    basePrice: "5.99",
    categoryName: "Desserts",
    imageFileName: null, // No image available
    preparationTimeMinutes: 5,
    sortOrder: 1,
    routingArea: "SALAD",
  },
  {
    name: "Apple Pie",
    description:
      "Classic homemade apple pie with cinnamon, served warm with ice cream",
    basePrice: "5.99",
    categoryName: "Desserts",
    imageFileName: null, // No image available
    preparationTimeMinutes: 10,
    sortOrder: 2,
    routingArea: "GRILL",
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
  // Main courses with spice level and add-ons
  "Thai Chicken Curry": ["SPICE_LEVEL", "ADD_ONS"],
  "Pizza Margherita": ["SIZE", "ADD_ONS"],
  "Ramen Noodle Bowl": ["SPICE_LEVEL", "ADD_ONS"],
  "Suki Hot Pot": ["SPICE_LEVEL"],

  // Drinks with temperature and size
  "Iced Latte": ["SIZE", "TEMPERATURE"],
  "Thai Milk Tea": ["SIZE", "TEMPERATURE"],
  "Strawberry Smoothie": ["SIZE"],
  "Fresh Orange Juice": ["SIZE"],

  // Desserts with add-ons
  "Chocolate Lava Cake": ["ADD_ONS"],
  "Ice Cream Sundae": ["ADD_ONS"],
};

/**
 * Helper to convert price string to Prisma Decimal
 */
export function toPrismaDecimal(
  priceString: string | null,
): Prisma.Decimal | null {
  if (priceString === null) return null;
  return new Prisma.Decimal(priceString);
}
