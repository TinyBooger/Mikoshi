FROM node:slim

WORKDIR /app

# Use Tencent Cloud intranet npm mirror for faster installs on Tencent servers
RUN npm config set registry http://mirrors.tencentyun.com/npm/

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# Serve the static SPA shell and built assets.
CMD ["node", "server.mjs"]