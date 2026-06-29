Markdown
# Moo Somnuk - Delivery & Store Management System 🚀

A comprehensive full-stack web application designed to streamline operations, manage deliveries, and handle both storefront and administrative tasks efficiently. 

This project demonstrates a modern web development workflow, emphasizing strong typing, secure data access, and a highly responsive user interface.

## 💻 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict typing across the entire application)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication:** Supabase Auth
- **Deployment:** [Vercel](https://vercel.com/) (CI/CD Pipeline)

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Implemented secure proxy middleware to manage permissions between Customer and Super Admin roles.
- **Customer Storefront:** A seamless shopping experience featuring product browsing and cart management.
- **Advanced Checkout System:** Integrated delivery date and time slot validation to ensure accurate order fulfillment.
- **Admin Dashboard:** Comprehensive tools for product management, inventory tracking, and user account creation.
- **Secure Architecture:** Built with robust security measures including Supabase Row Level Security (RLS) policies.

## 🚀 Live Demo

- **Production URL:** [https://delivery-store-management-wrkp.vercel.app/](https://delivery-store-management-wrkp.vercel.app/) *(Insert your actual live link here)*

## 🛠️ Getting Started

To run this project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/myframe258/Delivery_Store_Management.git](https://github.com/myframe258/Delivery_Store_Management.git)
Install dependencies:

Bash
npm install
Environment Variables:
Create a .env.local file in the root directory and add your Supabase credentials:

ข้อมูลโค้ด
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
Run the development server:

Bash
npm run dev
Open http://localhost:3000 with your browser to see the result.

📂 Project Structure Highlights
/src - Contains the main application logic, components, and Next.js App Router setup.

/public - Static assets and brand logos.

PROJECT_CONTEXT.md & Store_Batch_Delivery_PRD_v3.md - Core project documentation and Product Requirements.

Designed and developed by Vatchala Sinlapamon
