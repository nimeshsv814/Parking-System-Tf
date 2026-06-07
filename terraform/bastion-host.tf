resource "aws_instance" "bastion-host" {
  ami = var.ami_id
  instance_type = "t2.micro"
  key_name = var.key_name
  subnet_id = aws_subnet.public_subnets["web-public-subnet-1a"].id
  vpc_security_group_ids = [
    aws_security_group.bastion-host-sg.id
  ]
  associate_public_ip_address = true
  tags = {
    Name = "Bastion-Host"
  }
}