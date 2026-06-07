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
apt-get install -y docker.io

systemctl enable docker
systemctl start docker

mkdir -p /opt/frontend

cat <<ENVFILE > /opt/frontend/.env
VITE_AUTH_SERVICE_URL=/auth
VITE_PARKING_SERVICE_URL=/parking
VITE_BOOKING_SERVICE_URL=/booking
VITE_PAYMENT_SERVICE_URL=/payment
VITE_NOTIFICATION_SERVICE_URL=/notification
VITE_RAZORPAY_KEY_ID=rzp_test_ShFFMxa9JkqmZu
ENVFILE

docker pull nimeshsv814/frontend:0c1895a17d815b17ee999d3388ad5e9f667821ee

docker run -d \
  --name web-app \
  --restart unless-stopped \
  --env-file /opt/frontend/.env \
  -p 80:80 \
  nimeshsv814/frontend:0c1895a17d815b17ee999d3388ad5e9f667821ee

EOF

  tags = {
    Name = "Web-server"
  }
}