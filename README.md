# Banner Composer

An application for automating the creation of banners in various formats, complete with basic editing tools.

## Features

Banner Composer simplifies the banner creation process for campaigns by providing an intuitive and efficient workflow. It offers basic adjustment options and, at the end, creates a zip file containing all the generated banner formats for easy download.

### 1. Upload Area

-   **Images:** The tool works with up to two images simultaneously, allowing for different compositions across the various formats provided.
-   **Logos:** Start by uploading your brand or campaign logos. The application supports common formats and optimizes them for use in the banners. Logos are stored on a server, allowing future access without needing to re-upload.
![Upload imagens](https://i.imgur.com/ZDPm2ce.png)
![Upload logos](https://i.imgur.com/Itv2cM1.png)

### 2. Editing Area

-   **Slot Cards:** Customize the "slot cards" (cards representing each banner format) with images, text, and other graphic elements. The editing interface allows for quick adjustments and real-time previews.
![Slotcards](https://i.imgur.com/K1WZh0e.png)
![Slotcards](https://i.imgur.com/dfvoI6J.png)
![Janela de edição](https://i.imgur.com/vB6GgUY.png)

### 3. Final Assembly and "ENTREGA" Format

-   **Final Assembly:** After editing the slot cards, the application automatically organizes them into a basic layout for approval.
-   **Delivery Format:** The project is assembled in the standardized **ENTREGA** format, ensuring the dimensions and specifications are correct for publication.

## Getting Started

This project consists of a modern frontend built with **Vite** and **Node.js**, and a **Python** backend. The entire environment is orchestrated using **Docker** to simplify setup and ensure consistency.

-   **Node.js:** Provides the runtime environment for the frontend development server and build tools. It also manages project dependencies through npm.
-   **Vite:** A next-generation frontend tooling that provides a faster and leaner development experience, including a fast Hot Module Replacement (HMR) dev server and an optimized build command.

To get the Banner Composer running locally, you'll need **Docker** and **Docker Compose** installed.

### 1. Prerequisites

-   [Docker](https://docs.docker.com/get-docker/)
-   [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kimkjin/BannerComposer.git
    cd banner-composer
    ```

2.  **Environment Variables:**
    This project uses `.env` files for configuration. You will need to create them for the frontend and backend.
    -   In the `frontend` directory, create a `.env.frontend` file.
    -   In the `backend` directory, create a `.env.backend` file.
    *(You may need to add specific variables here based on the project's needs, such as API keys or database URIs.)*

3.  **Build and Run with Docker Compose:**
    From the root directory of the project, run the following command:
    ```bash
    docker-compose up --build
    ```
    This command will build the images for the frontend and backend services and start the containers.

4.  **Access the application:**
    -   The frontend should be available at `http://localhost:3000`.
    -   The backend API should be available at `http://localhost:5000`.

## How to Use

1.  Upload your images and logos.
2.  Edit and customize the slot cards in the editing area.
3.  Preview the final assembly.
4.  Export the banners in the "ENTREGA" format.

---

## Local Development (Without Docker)

If you prefer to run the services directly on your machine without Docker, follow these instructions.

### Prerequisites

-   **Node.js:** [v18.x or later](https://nodejs.org/)
-   **Python:** [v3.9 or later](https://www.python.org/) with `pip` and `venv`

### 1. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a virtual environment:**
    -   On Windows:
        ```bash
        python -m venv venv
        .\venv\Scripts\activate
        ```
    -   On macOS/Linux:
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure environment variables:**
    Create a file named `.env.backend` in the `backend` directory and add the necessary environment variables.

5.  **Run the backend server:**
    The backend is a FastAPI application and should be run with an ASGI server like Uvicorn.
    ```bash
    uvicorn main:app --reload
    ```
    -   `main:app` refers to the `app` instance inside the `main.py` file.
    -   The `--reload` flag automatically restarts the server when code changes are detected.

    The backend API will be running on `http://localhost:8000` (Uvicorn's default port).

### 2. Frontend Setup

1.  **Navigate to the frontend directory (in a new terminal):**
    ```bash
    cd frontend
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a file named `.env.frontend` in the `frontend` directory and add any necessary client-side environment variables (e.g., `VITE_API_BASE_URL=http://localhost:5000`).

4.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The frontend application will be available at `http://localhost:3000`.