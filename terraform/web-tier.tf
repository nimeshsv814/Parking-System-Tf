resource "aws_instance" "web-server" {
  ami           = var.ami_id
  instance_type = "t2.micro"
  key_name      = var.key_name

  subnet_id = aws_subnet.public_subnets["web-public-subnet-1a"].id

  vpc_security_group_ids = [
    aws_security_group.web-sg.id
  ]

  associate_public_ip_address = true

  user_data = <<-EOF
#!/bin/bash

apt-get update -y
apt-get install -y docker.io nginx

systemctl enable docker
systemctl start docker
systemctl enable nginx
systemctl start nginx

mkdir -p /opt/frontend

cat <<ENVFILE > /opt/frontend/.env
VITE_AUTH_SERVICE_URL=/auth
VITE_PARKING_SERVICE_URL=/parking
VITE_BOOKING_SERVICE_URL=/booking
VITE_PAYMENT_SERVICE_URL=/payment
VITE_NOTIFICATION_SERVICE_URL=/notification
VITE_RAZORPAY_KEY_ID=rzp_test_ShFFMxa9JkqmZu
ENVFILE

rm -f /etc/nginx/sites-enabled/default

cat <<'NGINXCONF' > /etc/nginx/conf.d/frontend.conf
server {
    listen 80 default_server;
    server_name _;

    location /auth {
        proxy_pass http://${aws_lb.internal_alb.dns_name};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /parking {
        proxy_pass http://${aws_lb.internal_alb.dns_name};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /booking {
        proxy_pass http://${aws_lb.internal_alb.dns_name};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /payment {
        proxy_pass http://${aws_lb.internal_alb.dns_name};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /notification {
        proxy_pass http://${aws_lb.internal_alb.dns_name};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXCONF

nginx -t && systemctl reload nginx

docker pull nimeshsv814/frontend:0c1895a17d815b17ee999d3388ad5e9f667821ee

docker run -d \
  --name web-app \
  --restart unless-stopped \
  --env-file /opt/frontend/.env \
  -p 127.0.0.1:8080:80 \
  nimeshsv814/frontend:0c1895a17d815b17ee999d3388ad5e9f667821ee

EOF

  tags = {
    Name = "Web-server"
  }
}
