export { toPrismaDecimal } from "../helpers/data-conversion.helper";

/**
 * Translation for an entity
 */
export interface Translation {
  locale: string;
  name: string;
  description?: string;
}

/**
 * Default categories created for new stores
 */
export interface DefaultCategory {
  name: string;
  sortOrder: number;
  translations: Translation[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: "Appetizers",
    sortOrder: 0,
    translations: [
      { locale: "en", name: "Appetizers" },
      { locale: "zh", name: "开胃菜" },
      { locale: "my", name: "အမြည်း" },
      { locale: "th", name: "ของทานเล่น" },
    ],
  },
  {
    name: "Main Courses",
    sortOrder: 1,
    translations: [
      { locale: "en", name: "Main Courses" },
      { locale: "zh", name: "主菜" },
      { locale: "my", name: "ပင်မဟင်းလျာ" },
      { locale: "th", name: "อาหารจานหลัก" },
    ],
  },
  {
    name: "Drinks",
    sortOrder: 2,
    translations: [
      { locale: "en", name: "Drinks" },
      { locale: "zh", name: "饮品" },
      { locale: "my", name: "အဖျော်ယမကာ" },
      { locale: "th", name: "เครื่องดื่ม" },
    ],
  },
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
  basePrice: string;
  categoryName: string;
  imageFileName: string | null;
  preparationTimeMinutes: number;
  sortOrder: number;
  routingArea?: string;
  translations: Translation[];
}

/**
 * Optimized default menu items - reduced to 6 items total (2 per category)
 * Images available: bread.jpg, chicken-curry.jpg, iced-latte.jpg, milk-tea.jpg,
 * pizza.jpg, vegetables-salad.jpg
 */
export const DEFAULT_MENU_ITEMS: DefaultMenuItem[] = [
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
    translations: [
      {
        locale: "en",
        name: "Garden Fresh Salad",
        description:
          "Crisp mixed greens with fresh vegetables, cherry tomatoes, and house vinaigrette",
      },
      {
        locale: "zh",
        name: "田园沙拉",
        description: "新鲜混合蔬菜配樱桃番茄和特制油醋汁",
      },
      {
        locale: "my",
        name: "ဟင်းသီးဟင်းရွက်သုပ်",
        description:
          "လတ်ဆတ်သော ဟင်းသီးဟင်းရွက်စုံ၊ ခရမ်းချဉ်သီး နှင့် အိမ်လုပ်ဆော့စ်",
      },
      {
        locale: "th",
        name: "สลัดผักรวม",
        description: "ผักสลัดสดกรอบ พร้อมมะเขือเทศราชินีและน้ำสลัดสูตรพิเศษ",
      },
    ],
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
    translations: [
      {
        locale: "en",
        name: "Garlic Bread",
        description:
          "Toasted artisan bread with garlic butter and herbs, served warm",
      },
      {
        locale: "zh",
        name: "蒜香烤面包",
        description: "香烤手工面包配蒜香黄油和香草，趁热享用",
      },
      {
        locale: "my",
        name: "ကြက်သွန်ဖြူပေါင်မုန့်",
        description:
          "ကြက်သွန်ဖြူထောပတ်နှင့် ဟင်းခတ်အမွှေးကြိုင်များသုတ်လိမ်းထားသော ပေါင်မုန့်ကင်",
      },
      {
        locale: "th",
        name: "ขนมปังกระเทียม",
        description: "ขนมปังโฮมเมดอบกรอบ ทาเนยกระเทียมและสมุนไพร เสิร์ฟร้อนๆ",
      },
    ],
  },

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
    translations: [
      {
        locale: "en",
        name: "Thai Chicken Curry",
        description:
          "Aromatic Thai red curry with tender chicken, vegetables, and coconut milk",
      },
      {
        locale: "zh",
        name: "泰式红咖喱鸡",
        description: "香浓泰式红咖喱配嫩滑鸡肉、蔬菜和椰奶",
      },
      {
        locale: "my",
        name: "ထိုင်းကြက်သားဟင်း",
        description:
          "ကြက်သား၊ ဟင်းသီးဟင်းရွက်နှင့် အုန်းနို့တို့ဖြင့်ချက်ပြုတ်ထားသော ထိုင်းဟင်းခါး",
      },
      {
        locale: "th",
        name: "แกงเผ็ดไก่",
        description: "แกงเผ็ดรสกลมกล่อม ใส่เนื้อไก่นุ่ม ผักสด และกะทิสด",
      },
    ],
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
    translations: [
      {
        locale: "en",
        name: "Pizza Margherita",
        description:
          "Classic Italian pizza with tomato sauce, mozzarella, fresh basil, and olive oil",
      },
      {
        locale: "zh",
        name: "玛格丽特披萨",
        description: "经典意式披萨，配番茄酱、马苏里拉奶酪、新鲜罗勒和橄榄油",
      },
      {
        locale: "my",
        name: "မာဂါရီတာ ပီဇာ",
        description:
          "ခရမ်းချဉ်သီးဆော့စ်၊ mozzarella ချိစ်၊ ပင်စိမ်းနှင့် သံလွင်ဆီပါဝင်သော ရိုးရာအီတလီပီဇာ",
      },
      {
        locale: "th",
        name: "พิซซ่ามาร์เกริต้า",
        description:
          "พิซซ่าอิตาเลียนต้นตำรับ ซอสมะเขือเทศ มอสซาเรลล่าชีส ใบโหระพา และน้ำมันมะกอก",
      },
    ],
  },

  {
    name: "Iced Latte",
    description: "Smooth espresso with cold milk over ice, lightly sweetened",
    basePrice: "4.99",
    categoryName: "Drinks",
    imageFileName: "iced-latte.jpg",
    preparationTimeMinutes: 5,
    sortOrder: 0,
    routingArea: "DRINKS",
    translations: [
      {
        locale: "en",
        name: "Iced Latte",
        description:
          "Smooth espresso with cold milk over ice, lightly sweetened",
      },
      {
        locale: "zh",
        name: "冰拿铁",
        description: "香醇浓缩咖啡配冰牛奶，微甜清爽",
      },
      {
        locale: "my",
        name: "လက်တေးအေး",
        description: "နို့နှင့် ကော်ဖီအရသာ ဆီလျော်စွာပေါင်းစပ်ထားသော လက်တေးအေး",
      },
      {
        locale: "th",
        name: "ลาเต้เย็น",
        description: "เอสเพรสโซ่นุ่มละมุนผสมนมสดเย็นและน้ำแข็ง หวานกำลังดี",
      },
    ],
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
    translations: [
      {
        locale: "en",
        name: "Thai Milk Tea",
        description: "Creamy Thai tea with condensed milk, served over ice",
      },
      {
        locale: "zh",
        name: "泰式奶茶",
        description: "浓郁泰式茶汤配炼乳，加冰口感更佳",
      },
      {
        locale: "my",
        name: "ထိုင်းလက်ဖက်ရည်",
        description: "နို့ဆီနှင့်ဖျော်စပ်ထားသော ထိုင်းလက်ဖက်ရည်အေး",
      },
      {
        locale: "th",
        name: "ชาไทยเย็น",
        description: "ชาไทยหอมเข้มข้นราดนมข้นหวาน เสิร์ฟเย็น",
      },
    ],
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
  translations: Translation[];
}

export interface DefaultCustomizationOption {
  name: string;
  additionalPrice: string | null;
  sortOrder: number;
  translations: Translation[];
}

/**
 * Customization group templates that can be applied to menu items
 */
export const CUSTOMIZATION_TEMPLATES = {
  SIZE: {
    name: "Size",
    minSelectable: 1,
    maxSelectable: 1,
    translations: [
      { locale: "en", name: "Size" },
      { locale: "zh", name: "规格" },
      { locale: "my", name: "အရွယ်အစား" },
      { locale: "th", name: "ขนาด" },
    ],
    options: [
      {
        name: "Small",
        additionalPrice: null,
        sortOrder: 0,
        translations: [
          { locale: "en", name: "Small" },
          { locale: "zh", name: "小杯" },
          { locale: "my", name: "အသေး" },
          { locale: "th", name: "เล็ก" },
        ],
      },
      {
        name: "Medium",
        additionalPrice: "2.00",
        sortOrder: 1,
        translations: [
          { locale: "en", name: "Medium" },
          { locale: "zh", name: "中杯" },
          { locale: "my", name: "အလတ်" },
          { locale: "th", name: "กลาง" },
        ],
      },
      {
        name: "Large",
        additionalPrice: "4.00",
        sortOrder: 2,
        translations: [
          { locale: "en", name: "Large" },
          { locale: "zh", name: "大杯" },
          { locale: "my", name: "အကြီး" },
          { locale: "th", name: "ใหญ่" },
        ],
      },
    ],
  } as DefaultCustomizationGroup,

  SPICE_LEVEL: {
    name: "Spice Level",
    minSelectable: 0,
    maxSelectable: 1,
    translations: [
      { locale: "en", name: "Spice Level" },
      { locale: "zh", name: "辣度" },
      { locale: "my", name: "အစပ်အဆင့်" },
      { locale: "th", name: "ระดับความเผ็ด" },
    ],
    options: [
      {
        name: "Mild",
        additionalPrice: null,
        sortOrder: 0,
        translations: [
          { locale: "en", name: "Mild" },
          { locale: "zh", name: "微辣" },
          { locale: "my", name: "အစပ်နည်း" },
          { locale: "th", name: "เผ็ดน้อย" },
        ],
      },
      {
        name: "Medium",
        additionalPrice: null,
        sortOrder: 1,
        translations: [
          { locale: "en", name: "Medium" },
          { locale: "zh", name: "中辣" },
          { locale: "my", name: "အစပ်အနေတော်" },
          { locale: "th", name: "เผ็ดปานกลาง" },
        ],
      },
      {
        name: "Hot",
        additionalPrice: null,
        sortOrder: 2,
        translations: [
          { locale: "en", name: "Hot" },
          { locale: "zh", name: "辣" },
          { locale: "my", name: "အစပ်" },
          { locale: "th", name: "เผ็ด" },
        ],
      },
      {
        name: "Extra Hot",
        additionalPrice: null,
        sortOrder: 3,
        translations: [
          { locale: "en", name: "Extra Hot" },
          { locale: "zh", name: "特辣" },
          { locale: "my", name: "အလွန်စပ်" },
          { locale: "th", name: "เผ็ดมาก" },
        ],
      },
    ],
  } as DefaultCustomizationGroup,

  ADD_ONS: {
    name: "Add Ons",
    minSelectable: 0,
    maxSelectable: 3,
    translations: [
      { locale: "en", name: "Add Ons" },
      { locale: "zh", name: "加料" },
      { locale: "my", name: "ထပ်ထည့်ရန်" },
      { locale: "th", name: "เพิ่มเติม" },
    ],
    options: [
      {
        name: "Extra Cheese",
        additionalPrice: "1.50",
        sortOrder: 0,
        translations: [
          { locale: "en", name: "Extra Cheese" },
          { locale: "zh", name: "加芝士" },
          { locale: "my", name: "ချိစ်အပို" },
          { locale: "th", name: "เพิ่มชีส" },
        ],
      },
      {
        name: "Bacon",
        additionalPrice: "2.00",
        sortOrder: 1,
        translations: [
          { locale: "en", name: "Bacon" },
          { locale: "zh", name: "培根" },
          { locale: "my", name: "ဘေကွန်" },
          { locale: "th", name: "เบคอน" },
        ],
      },
      {
        name: "Avocado",
        additionalPrice: "2.50",
        sortOrder: 2,
        translations: [
          { locale: "en", name: "Avocado" },
          { locale: "zh", name: "牛油果" },
          { locale: "my", name: "ထောပတ်သီး" },
          { locale: "th", name: "อโวคาโด" },
        ],
      },
      {
        name: "Extra Vegetables",
        additionalPrice: "1.00",
        sortOrder: 3,
        translations: [
          { locale: "en", name: "Extra Vegetables" },
          { locale: "zh", name: "加蔬菜" },
          { locale: "my", name: "ဟင်းသီးဟင်းရွက်အပို" },
          { locale: "th", name: "เพิ่มผัก" },
        ],
      },
      {
        name: "Extra Protein",
        additionalPrice: "3.00",
        sortOrder: 4,
        translations: [
          { locale: "en", name: "Extra Protein" },
          { locale: "zh", name: "加肉" },
          { locale: "my", name: "အသားအပို" },
          { locale: "th", name: "เพิ่มเนื้อสัตว์" },
        ],
      },
    ],
  } as DefaultCustomizationGroup,

  TEMPERATURE: {
    name: "Temperature",
    minSelectable: 1,
    maxSelectable: 1,
    translations: [
      { locale: "en", name: "Temperature" },
      { locale: "zh", name: "温度" },
      { locale: "my", name: "အပူ/အအေး" },
      { locale: "th", name: "ความร้อน/เย็น" },
    ],
    options: [
      {
        name: "Hot",
        additionalPrice: null,
        sortOrder: 0,
        translations: [
          { locale: "en", name: "Hot" },
          { locale: "zh", name: "热" },
          { locale: "my", name: "အပူ" },
          { locale: "th", name: "ร้อน" },
        ],
      },
      {
        name: "Iced",
        additionalPrice: null,
        sortOrder: 1,
        translations: [
          { locale: "en", name: "Iced" },
          { locale: "zh", name: "冰" },
          { locale: "my", name: "အအေး" },
          { locale: "th", name: "เย็น" },
        ],
      },
    ],
  } as DefaultCustomizationGroup,
};

/**
 * Mapping of menu items to their customization groups
 * Key is menu item name, value is array of customization template keys
 */
export const MENU_ITEM_CUSTOMIZATIONS: Record<string, string[]> = {
  "Thai Chicken Curry": ["SPICE_LEVEL", "ADD_ONS"],
  "Pizza Margherita": ["SIZE", "ADD_ONS"],
  "Iced Latte": ["SIZE", "TEMPERATURE"],
  "Thai Milk Tea": ["SIZE", "TEMPERATURE"],
};
