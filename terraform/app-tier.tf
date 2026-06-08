resource "aws_instance" "backend_server" {

  ami           = var.ami_id
  instance_type = "t2.micro"
  key_name      = var.key_name

  subnet_id = aws_subnet.app_private_subnets["app-private-subnet-1a"].id

  vpc_security_group_ids = [
    aws_security_group.app-sg.id
  ]

  user_data = <<-EOF
#!/bin/bash

apt-get update -y
apt-get install -y docker.io nginx

systemctl enable docker
systemctl start docker
systemctl enable nginx
systemctl start nginx

mkdir -p /opt/microservices

cat <<EOT > /opt/microservices/auth.env
PORT=4001
MONGO_URI=mongodb://${aws_instance.database.private_ip}:27017/authdb
JWT_SECRET=smartparking_super_secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
SEED_ADMIN_EMAIL=admin@parking.com
SEED_ADMIN_PASSWORD=Admin@123
SEED_USER_EMAIL=user@parking.com
SEED_USER_PASSWORD=User@123
EOT

cat <<EOT > /opt/microservices/parking.env
PORT=4002
MONGO_URI=mongodb://${aws_instance.database.private_ip}:27017/parkingdb
JWT_SECRET=smartparking_super_secret
CORS_ORIGIN=*
INTERNAL_API_KEY=smartparking_internal_key
EOT

cat <<EOT > /opt/microservices/booking.env
PORT=4003
MONGO_URI=mongodb://${aws_instance.database.private_ip}:27017/bookingdb
JWT_SECRET=smartparking_super_secret
CORS_ORIGIN=*
PARKING_SERVICE_URL=http://parking-service:4002
NOTIFICATION_SERVICE_URL=http://notification-service:4006
INTERNAL_API_KEY=smartparking_internal_key
BOOKING_HOLD_MINUTES=10
EOT

cat <<EOT > /opt/microservices/payment.env
PORT=4004
MONGO_URI=mongodb://${aws_instance.database.private_ip}:27017/paymentdb
JWT_SECRET=smartparking_super_secret
CORS_ORIGIN=*
BOOKING_SERVICE_URL=http://booking-service:4003
NOTIFICATION_SERVICE_URL=http://notification-service:4006
INTERNAL_API_KEY=smartparking_internal_key
RAZORPAY_KEY_ID=rzp_test_ShFFMxa9JkqmZu
RAZORPAY_KEY_SECRET=REPLACE_ME
EOT

cat <<EOT > /opt/microservices/scheduler.env
PORT=4005
BOOKING_SERVICE_URL=http://booking-service:4003
INTERNAL_API_KEY=smartparking_internal_key
CRON_SCHEDULE=* * * * *
EOT

cat <<EOT > /opt/microservices/notification.env
PORT=4006
MONGO_URI=mongodb://${aws_instance.database.private_ip}:27017/notificationdb
JWT_SECRET=smartparking_super_secret
CORS_ORIGIN=*
INTERNAL_API_KEY=smartparking_internal_key
EOT

rm -f /etc/nginx/sites-enabled/default

cat <<'NGINXCONF' > /etc/nginx/conf.d/backend-proxy.conf
server {
    listen 80 default_server;
    server_name _;

    location /auth {
        rewrite ^/auth/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /parking {
        rewrite ^/parking/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /booking {
        rewrite ^/booking/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /payment {
        rewrite ^/payment/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /notification {
        rewrite ^/notification/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4006;
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
}
NGINXCONF

nginx -t && systemctl reload nginx

docker pull nimeshsv814/auth-service:v1.3.0
docker pull nimeshsv814/parking-service:0d618dae7b512b578cbd3f8973d272ee2de36c51
docker pull nimeshsv814/booking-service:bcb8c00fe92695ea4af42ee2e73c78376838d579
docker pull nimeshsv814/payment-service:18da9995410b113da6006f084b2121bda2d305be
docker pull nimeshsv814/scheduler-service:v1.0.0
docker pull nimeshsv814/notification-service:e3f10da8c6833c88afb73f52a30f29b8e23fa5c2

docker run -d \
  --name auth-service \
  --env-file /opt/microservices/auth.env \
  -p 4001:4001 \
  --restart unless-stopped \
  nimeshsv814/auth-service:v1.3.0


docker run -d \
  --name parking-service \
  --env-file /opt/microservices/parking.env \
  -p 4002:4002 \
  --restart unless-stopped \
  nimeshsv814/parking-service:0d618dae7b512b578cbd3f8973d272ee2de36c51

docker run -d \
  --name booking-service \
  --env-file /opt/microservices/booking.env \
  -p 4003:4003 \
  --restart unless-stopped \
  nimeshsv814/booking-service:bcb8c00fe92695ea4af42ee2e73c78376838d579

docker run -d \
  --name payment-service \
  --env-file /opt/microservices/payment.env \
  -p 4004:4004 \
  --restart unless-stopped \
  nimeshsv814/payment-service:18da9995410b113da6006f084b2121bda2d305be

docker run -d \
  --name scheduler-service \
  --env-file /opt/microservices/scheduler.env \
  -p 4005:4005 \
  --restart unless-stopped \
  nimeshsv814/scheduler-service:v1.0.0

docker run -d \
  --name notification-service \
  --env-file /opt/microservices/notification.env \
  -p 4006:4006 \
  --restart unless-stopped \
  nimeshsv814/notification-service:e3f10da8c6833c88afb73f52a30f29b8e23fa5c2

EOF

  tags = {
    Name = "backend-server"
  }
}

resource "aws_lb" "external_alb" {
  name               = "external-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.externalALB-sg.id]
  subnets            = [for s in aws_subnet.public_subnets : s.id]

  tags = {
    Name = "external-alb"
  }
}

resource "aws_lb_target_group" "web_tg" {
  name        = "tg-web"
  port        = 80
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = "/health"
    matcher             = "200-399"
    interval            = 30
    healthy_threshold   = 3
    unhealthy_threshold = 2
    timeout             = 5
  }
}

resource "aws_lb_listener" "external_http_listener" {
  load_balancer_arn = aws_lb.external_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

resource "aws_lb_target_group_attachment" "web" {
  target_group_arn = aws_lb_target_group.web_tg.arn
  target_id        = aws_instance.web-server.id
  port             = 80
}

resource "aws_lb" "internal_alb" {
  name               = "smart-parking-internal-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.internalALB-sg.id]
  subnets            = [for s in aws_subnet.app_private_subnets : s.id]

  tags = {
    Name = "smart-parking-internal-alb"
  }
}

resource "aws_lb_target_group" "app_tg" {
  name        = "tg-app-services"
  port        = 80
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = "/health"
    matcher             = "200-399"
    interval            = 30
    healthy_threshold   = 3
    unhealthy_threshold = 2
    timeout             = 5
  }
}

resource "aws_lb_listener" "internal_http_listener" {
  load_balancer_arn = aws_lb.internal_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app_tg.arn
  target_id        = aws_instance.backend_server.id
  port             = 80
}
