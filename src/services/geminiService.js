const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require('../config/db');

class GeminiService {
    constructor() {
        console.log('🤖 Initializing Gemini Service...');
        
        // Check if API key exists
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY is not defined in .env file');
            this.apiKey = null;
            return;
        }
        
        this.apiKey = process.env.GEMINI_API_KEY;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        
        // Initialize without context - will be built dynamically
        console.log('✅ Gemini 3 Flash Preview initialized');
        
        // Cache menu to avoid DB calls every time
        this.menuCache = null;
        this.lastMenuFetch = null;
    }

    // Build restaurant context from database
    async buildContext() {
        try {
            // Fetch menu from database (refresh every 5 minutes)
            const shouldRefresh = !this.menuCache || 
                !this.lastMenuFetch || 
                (Date.now() - this.lastMenuFetch) > 300000; // 5 minutes
            
            if (shouldRefresh) {
                console.log('📦 Fetching fresh menu from database...');
                
                // Get all menu items
                const [menuItems] = await db.query(
                    'SELECT * FROM menu_items WHERE is_available = true ORDER BY category, name'
                );
                
                // Format menu items for AI context
                let menuText = '';
                menuItems.forEach(item => {
                    menuText += `${item.id}. ${item.name} - RM ${parseFloat(item.price).toFixed(2)}\n`;
                    if (item.description) {
                        menuText += `   - Description: ${item.description}\n`;
                    }
                    if (item.category) {
                        menuText += `   - Category: ${item.category}\n`;
                    }
                });
                
                // Get catering packages if table exists
                let cateringText = '';
                try {
                    const [packages] = await db.query('SELECT * FROM catering_packages');
                    if (packages.length > 0) {
                        cateringText = '\nCATERING PACKAGES:\n';
                        packages.forEach(pkg => {
                            cateringText += `- ${pkg.name}: RM ${pkg.price_per_person}/person\n`;
                            if (pkg.description) cateringText += `  ${pkg.description}\n`;
                        });
                    }
                } catch (e) {
                    cateringText = '\nCATERING: Contact us for catering packages.\n';
                }
                
                // Build complete context
                this.menuCache = `
You are a helpful AI assistant for "Arbhi Catering", a Malaysian restaurant located in Keramat, Kuala Lumpur.

RESTAURANT INFORMATION:
- Name: Arbhi Catering Enterprise
- Location: Keramat, Kuala Lumpur
- Cuisine: Malaysian, Halal
- Opening Hours: 10:00 AM - 10:00 PM daily (Friday: 10am-12:30pm & 2:30pm-10pm)

CURRENT MENU ITEMS:
${menuText || 'No menu items currently available.'}

${cateringText}

CONTACT INFORMATION:
- Phone: 012-345 6789
- WhatsApp: 012-345 6789
- Email: arbhi.catering@gmail.com
- Address: No. 23, Jalan Keramat, 54000 Kuala Lumpur

DELIVERY:
- Available on GrabFood and FoodPanda
- Delivery fee: RM 3-5 within Keramat area

PARKING:
- Free parking available behind the restaurant

HALAL STATUS:
- 100% Halal certified. No pork, no alcohol.

PAYMENT METHODS:
- Cash, Credit/Debit Card, Touch 'n Go eWallet, QR Pay (DuitNow), FPX

RULES FOR RESPONDING:
1. Be friendly and helpful, use emojis occasionally 😊
2. You can respond in Malay, English, or mix (Bahasa Rojak)
3. If asked about prices, always mention the current RM amount
4. For items not in the menu, politely say it's not available
5. If customer wants to order, guide them to use the website QR code
6. For catering, ask about guest count and event type
7. Keep responses concise but informative
8. Never make up information not in the menu above
`;
                
                this.lastMenuFetch = Date.now();
                console.log(`✅ Menu updated: ${menuItems.length} items loaded`);
            }
            
            return this.menuCache;
            
        } catch (error) {
            console.error('❌ Error building context:', error);
            return this.getFallbackContext();
        }
    }

    // Fallback context if database fails
    getFallbackContext() {
        return `
You are a helpful AI assistant for "Arbhi Catering", a Malaysian restaurant.
Please ask customers to check our physical menu or website for current items.
For specific questions, they can contact us at 012-345 6789.
`;
    }

    async generateResponse(userMessage) {
        try {
            console.log("📤 User message:", userMessage);
            
            // Get fresh context with current menu
            const context = await this.buildContext();
            
            const prompt = `${context}\n\nCustomer: ${userMessage}\nAssistant:`;
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log("📥 Gemini response received");
            
            return {
                success: true,
                message: text,
                source: 'gemini-flash'
            };
            
        } catch (error) {
            console.error("❌ Gemini API error:", error.message);
            
            // Try one more time with fresh context
            try {
                this.menuCache = null; // Force refresh
                const context = await this.buildContext();
                const prompt = `${context}\n\nCustomer: ${userMessage}\nAssistant:`;
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                
                return {
                    success: true,
                    message: text,
                    source: 'gemini-flash-retry'
                };
            } catch (retryError) {
                return this.fallbackResponse(userMessage);
            }
        }
    }

    fallbackResponse(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        
        if (lowerMsg.includes('halal')) {
            return {
                success: true,
                message: "✅ Yes! Arbhi Catering is 100% HALAL certified.",
                source: 'fallback'
            };
        }
        if (lowerMsg.includes('hour') || lowerMsg.includes('open')) {
            return {
                success: true,
                message: "🕒 We're open daily from 10:00 AM to 10:00 PM.",
                source: 'fallback'
            };
        }
        if (lowerMsg.includes('contact') || lowerMsg.includes('phone')) {
            return {
                success: true,
                message: "📞 You can reach us at 012-345 6789 or WhatsApp the same number.",
                source: 'fallback'
            };
        }
        
        return {
            success: true,
            message: "I'm having trouble accessing the menu. Please ask our staff for assistance or check our physical menu.",
            source: 'fallback'
        };
    }
}

module.exports = new GeminiService();