// Restaurant Knowledge Base
const faqData = {
    // Menu related
    menu: {
        keywords: ['menu', 'food', 'dish', 'eat', 'makan', 'what do you have'],
        responses: [
            "Here's our popular menu:\n• Nasi Lemak (RM 8) - with fried chicken\n• Chicken Satay (RM 12) - 10 sticks\n• Mee Goreng Mamak (RM 10)\n• Roti Canai (RM 2.50)\n• Teh Tarik (RM 2.50)\n\nWould you like details about any specific dish?"
        ]
    },
    
    // Price related
    price: {
        keywords: ['price', 'cost', 'harga', 'how much', 'rm', 'berapa'],
        responses: [
            "Our prices range from RM 2.50 to RM 25.\n\n• Nasi Lemak: RM 8\n• Chicken Satay: RM 12\n• Mee Goreng: RM 10\n• Roti Canai: RM 2.50\n• Teh Tarik: RM 2.50\n\nMost dishes are between RM 8-15."
        ]
    },
    
    // Halal
    halal: {
        keywords: ['halal', 'muslim', '清真', 'pork', 'alcohol'],
        responses: [
            "✅ Yes! Arbhi Catering is 100% HALAL certified. We use only halal ingredients and our kitchen follows strict halal practices."
        ]
    },
    
    // Spicy
    spicy: {
        keywords: ['spicy', 'pedas', 'hot', 'sambal', 'cili'],
        responses: [
            "🌶️ Spicy lovers! Our Nasi Lemak comes with sambal (medium spice). You can ask for extra sambal if you want it hotter!\n\nOther spicy options:\n• Mee Goreng Pedas\n• Ayam Berlado\n• Sambal Udang"
        ]
    },
    
    // Vegetarian
    vegetarian: {
        keywords: ['vegetarian', 'vege', 'veg', 'no meat', 'sayur'],
        responses: [
            "🥗 Vegetarian options available:\n• Vegetable Biryani (RM 10)\n• Tofu Satay (RM 9)\n• Chapati with Dal (RM 8)\n• Roti Canai (RM 2.50)\n\nAll prepared separately from meat dishes."
        ]
    },
    
    // Hours
    hours: {
        keywords: ['hour', 'open', 'close', 'time', 'operating', 'buka', 'tutup'],
        responses: [
            "🕒 We're open:\n• Monday - Sunday: 10:00 AM - 10:00 PM\n• Friday: 10:00 AM - 12:30 PM & 2:30 PM - 10:00 PM\n\nWe're open every day including public holidays!"
        ]
    },
    
    // Location
    location: {
        keywords: ['location', 'address', 'where', 'directions', 'map', 'jalan', 'keramat'],
        responses: [
            "📍 Arbhi Catering is located in Keramat, Kuala Lumpur.\n\nAddress: No. 23, Jalan Keramat, 54000 Kuala Lumpur\n\nNearby landmarks:\n• Opposite Shell petrol station\n• Next to Maybank\n• 5 minutes from LRT Keramat"
        ]
    },
    
    // Parking
    parking: {
        keywords: ['parking', 'park', 'car', 'kereta'],
        responses: [
            "🅿️ Free parking available!\n• Behind the restaurant (20 spaces)\n• Street parking available\n• Motorcycle parking in front"
        ]
    },
    
    // Contact
    contact: {
        keywords: ['contact', 'phone', 'call', 'whatsapp', 'email', 'telefon'],
        responses: [
            "📞 Contact us:\n• Phone: 012-345 6789\n• WhatsApp: 012-345 6789\n• Email: arbhi.catering@gmail.com\n\nWe usually respond within 30 minutes."
        ]
    },
    
    // Delivery
    delivery: {
        keywords: ['delivery', 'deliver', 'grab', 'foodpanda', 'panda', 'order online'],
        responses: [
            "🛵 We're available on:\n• GrabFood\n• FoodPanda\n\nDelivery fee: RM 3-5 within Keramat.\n\nYou can also order directly from us for pickup!"
        ]
    },
    
    // Payment
    payment: {
        keywords: ['payment', 'pay', 'cash', 'card', 'touch n go', 'tng', 'fpx'],
        responses: [
            "💳 We accept:\n• Cash\n• Credit/Debit Card\n• Touch 'n Go eWallet\n• QR Pay (DuitNow)\n• FPX Online Banking\n\nAll payments are secure."
        ]
    },
    
    // Catering
    catering: {
        keywords: ['catering', 'event', 'party', 'wedding', 'function', 'katering'],
        responses: [
            "🎉 Catering services available!\n\nPackages start from RM 25/person.\n• Basic: RM 25/pax\n• Premium: RM 45/pax\n• Corporate: RM 35/pax\n• Wedding: Custom quote\n\nContact us for a free consultation!"
        ]
    },
    
    // Special requests
    special: {
        keywords: ['allergy', 'allergic', 'dietary', 'gluten', 'dairy', 'allergi'],
        responses: [
            "⚠️ Please inform us about any allergies!\n\nWe can accommodate:\n• Gluten-free\n• Dairy-free\n• Nut-free\n• Spice level adjustments\n\nJust let our staff know when ordering."
        ]
    },
    
    // Best sellers
    bestseller: {
        keywords: ['best', 'popular', 'famous', 'recommend', 'favorite', 'sedap', 'best seller'],
        responses: [
            "⭐ Our best sellers:\n\n1. Nasi Lemak with Fried Chicken (80% of customers love it!)\n2. Chicken Satay\n3. Mee Goreng Mamak\n4. Teh Tarik Special\n\nWant to try the top 3 combo? Ask our staff!"
        ]
    },
    
    // Greetings
    greeting: {
        keywords: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'assalamualaikum', 'hai'],
        responses: [
            "Hello! 👋 Welcome to Arbhi Catering! How can I help you today?",
            "Hi there! 😊 What would you like to know about our menu?",
            "Assalamualaikum! Welcome to Arbhi Catering. Feel free to ask me anything!"
        ]
    },
    
    // Thanks
    thanks: {
        keywords: ['thank', 'thanks', 'terima kasih', 'appreciate'],
        responses: [
            "You're welcome! 😊 Anything else I can help with?",
            "My pleasure! Let me know if you need anything else.",
            "Happy to help! Enjoy your meal!"
        ]
    },
    
    // Fallback (when no match)
    fallback: [
        "I'm not sure about that. Could you ask differently? Or ask our staff for help!",
        "Sorry, I don't have that information. Would you like to ask about our menu, prices, or hours instead?",
        "Hmm, I'm still learning. Try asking about:\n• Menu items\n• Prices\n• Opening hours\n• Location\n• Halal status"
    ]
};

// Export both keywords and responses
module.exports = {
    faqData,
    
    // Function to find best matching response
    findResponse: (question) => {
        const lowerQuestion = question.toLowerCase();
        
        // Check each category
        for (const [category, data] of Object.entries(faqData)) {
            if (category === 'fallback') continue;
            
            // Check if any keyword matches
            const matched = data.keywords.some(keyword => 
                lowerQuestion.includes(keyword.toLowerCase())
            );
            
            if (matched) {
                // Random response if multiple
                const responses = data.responses;
                const randomIndex = Math.floor(Math.random() * responses.length);
                return {
                    category,
                    response: responses[randomIndex]
                };
            }
        }
        
        // No match - return random fallback
        const fallbacks = faqData.fallback;
        const randomIndex = Math.floor(Math.random() * fallbacks.length);
        return {
            category: 'fallback',
            response: fallbacks[randomIndex]
        };
    }
};