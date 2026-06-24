FROM node:20-alpine

# 1. Instalar LibreOffice (requerido de forma nativa por Carbone.io para renderizar DOCX a PDF) y curl
RUN apk add --no-cache libreoffice udev ttf-dejavu curl

# 2. Instalar pnpm globalmente
RUN npm install -g pnpm

WORKDIR /app

# 3. Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# 4. Instalar dependencias
RUN pnpm install

# 5. Copiar el resto del código
COPY . .

# 6. Exponer puerto de NestJS
EXPOSE 3000

# Por defecto, ejecutar la aplicación en producción (el compose puede sobrescribir esto en desarrollo)
CMD ["pnpm", "run", "start:prod"]
