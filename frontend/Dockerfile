FROM node:slim

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 安装serve来提供静态文件
RUN npm install -g serve

# 暴露端口
EXPOSE 3000

# 使用serve运行构建后的文件
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]