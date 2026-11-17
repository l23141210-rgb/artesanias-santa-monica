FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html pagar.html admin.html script.js catalogo.js styles.css /usr/share/nginx/html/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80