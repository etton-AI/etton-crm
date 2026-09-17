FROM nginx:1.27-alpine

# nginx 配置：根路径 302 → /monthly-public.html，保证 M.isPublic() 按文件名识别
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 仅静态站点（脱敏公网版），不含内网真实数据
COPY site/ /usr/share/nginx/html/

EXPOSE 80
