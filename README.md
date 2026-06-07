# Smart Parking AWS Microservices Deployment Guide

This guide ignores the `monolithic` folder and describes how to deploy the original microservices with:

- Frontend in public subnets.
- Backend microservices in private subnets.
- MongoDB in private database subnets.
- Application Load Balancers and target groups for routing.

## Recommended Architecture

```text
Internet
   |
Route 53: parking.example.com
   |
Public Application Load Balancer
   |-- /                 -> frontend target group
   |-- /auth/*           -> auth-service target group
   |-- /parking/*        -> parking-service target group
   |-- /booking/*        -> booking-service target group
   |-- /payment/*        -> payment-service target group
   |-- /notification/*   -> notification-service target group

Private subnets
   |
Backend microservices
   |
Internal Application Load Balancer for service-to-service calls
   |-- /parking/*        -> parking-service target group
   |-- /booking/*        -> booking-service target group
   |-- /notification/*   -> notification-service target group

Private database subnets
   |
MongoDB
```

Important: browsers cannot directly call services in private subnets. The frontend should call the public ALB using the same relative paths already in `frontend/.env`:

```env
VITE_AUTH_SERVICE_URL=/auth
VITE_PARKING_SERVICE_URL=/parking
VITE_BOOKING_SERVICE_URL=/booking
VITE_PAYMENT_SERVICE_URL=/payment
VITE_NOTIFICATION_SERVICE_URL=/notification
```

The public ALB receives those paths and forwards them to private backend targets.

## VPC And Subnets

Create one VPC across at least two Availability Zones.

| Subnet type | Example CIDR | Route table | Used for |
| --- | --- | --- | --- |
| Public subnet A | `10.0.1.0/24` | Internet Gateway route | Public ALB, frontend targets if you run frontend on EC2 |
| Public subnet B | `10.0.2.0/24` | Internet Gateway route | Public ALB, frontend targets if you run frontend on EC2 |
| Private app subnet A | `10.0.11.0/24` | NAT Gateway route or VPC endpoints | Backend microservices |
| Private app subnet B | `10.0.12.0/24` | NAT Gateway route or VPC endpoints | Backend microservices |
| Private DB subnet A | `10.0.21.0/24` | No internet route | MongoDB |
| Private DB subnet B | `10.0.22.0/24` | No internet route | MongoDB standby/replica |

Private app subnets need outbound internet only if the instances/tasks must pull images, install packages, or call public APIs such as Razorpay. Use a NAT Gateway or private VPC endpoints where possible.

## Security Groups

Create these security groups first.

| Security group | Inbound rules | Outbound rules |
| --- | --- | --- |
| `sg-public-alb` | `80` and `443` from `0.0.0.0/0` | To `sg-frontend` on frontend port and `sg-backend` on service ports |
| `sg-frontend` | `80` from `sg-public-alb` | HTTPS outbound as needed |
| `sg-internal-alb` | `80` from `sg-backend` | To `sg-backend` on service ports |
| `sg-backend` | `4001-4006` from `sg-public-alb`; `4001-4006` from `sg-internal-alb` | To `sg-internal-alb:80`, `sg-mongo:27017`, HTTPS outbound if needed |
| `sg-mongo` | `27017` from `sg-backend` | Keep default outbound or restrict as needed |

Do not allow public inbound traffic directly to backend instances/tasks.

## Target Groups

Use one target group per service. If you deploy on ECS Fargate or EKS pods, use target type `ip`. If you deploy on EC2 instances with Auto Scaling Groups, use target type `instance`.

| Target group | Protocol | Port | Targets | Health check path | Public ALB rule |
| --- | --- | --- | --- | --- | --- |
| `tg-frontend` | HTTP | `80` | Frontend Nginx/container/EC2 | `/` | Default action `/` |
| `tg-auth-service` | HTTP | `4001` | `auth-service` | `/health` | `/auth`, `/auth/*` |
| `tg-parking-service` | HTTP | `4002` | `parking-service` | `/health` | `/parking`, `/parking/*` |
| `tg-booking-service` | HTTP | `4003` | `booking-service` | `/health` | `/booking`, `/booking/*` |
| `tg-payment-service` | HTTP | `4004` | `payment-service` | `/health` | `/payment`, `/payment/*` |
| `tg-notification-service` | HTTP | `4006` | `notification-service` | `/health` | `/notification`, `/notification/*` |
| `tg-scheduler-service` | HTTP | `4005` | `scheduler-service` | `/health` | No public rule |

Notes:

- Health checks go directly from the target group to the service. Use `/health`, not `/auth/health` or `/booking/health`.
- MongoDB does not need an ALB target group.
- The scheduler usually does not need public traffic. Register it only if you want ALB health visibility.

## Public Application Load Balancer

Create an Application Load Balancer:

- Name: `smart-parking-public-alb`
- Scheme: `internet-facing`
- Subnets: public subnets in at least two Availability Zones
- Security group: `sg-public-alb`
- Listener `80`: redirect to `443`
- Listener `443`: use an ACM certificate for your domain

Create listener rules on the HTTPS listener.

| Priority | Condition | URL rewrite transform | Forward to |
| --- | --- | --- | --- |
| `10` | Path `/auth` or `/auth/*` | Regex `^/auth/?(.*)$`, replace `/$1` | `tg-auth-service` |
| `20` | Path `/parking` or `/parking/*` | Regex `^/parking/?(.*)$`, replace `/$1` | `tg-parking-service` |
| `30` | Path `/booking` or `/booking/*` | Regex `^/booking/?(.*)$`, replace `/$1` | `tg-booking-service` |
| `40` | Path `/payment` or `/payment/*` | Regex `^/payment/?(.*)$`, replace `/$1` | `tg-payment-service` |
| `50` | Path `/notification` or `/notification/*` | Regex `^/notification/?(.*)$`, replace `/$1` | `tg-notification-service` |
| Default | No condition | None | `tg-frontend` |

Why rewrite is required: the frontend calls `/auth/login`, but `auth-service` defines `POST /login`. The rewrite changes `/auth/login` to `/login` before the request reaches the target. This matches the existing Kubernetes gateway behavior in `infra/k8s/gateway/httpRoutes.yaml`.

If your AWS account or tooling does not expose ALB URL rewrite transforms, use one of these alternatives:

- Put Nginx in front of the services and rewrite `/auth/*` to `/*`.
- Change each Express service to mount its routes under its prefix, such as `app.use("/auth", authRoutes)`.
- Use separate subdomains, such as `auth.example.com`, and set frontend environment variables to those full URLs.

## Internal Application Load Balancer

Create a second ALB for private service-to-service traffic:

- Name: `smart-parking-internal-alb`
- Scheme: `internal`
- Subnets: private app subnets in at least two Availability Zones
- Security group: `sg-internal-alb`
- Listener `80`: HTTP

Use the same backend target groups and the same path rewrite rules:

| Priority | Condition | URL rewrite transform | Forward to |
| --- | --- | --- | --- |
| `10` | `/parking`, `/parking/*` | `^/parking/?(.*)$` -> `/$1` | `tg-parking-service` |
| `20` | `/booking`, `/booking/*` | `^/booking/?(.*)$` -> `/$1` | `tg-booking-service` |
| `30` | `/notification`, `/notification/*` | `^/notification/?(.*)$` -> `/$1` | `tg-notification-service` |
| Default | No condition | None | Fixed response `404` |

Then configure backend environment variables to use the internal ALB DNS name:

```env
# booking-service
PARKING_SERVICE_URL=http://smart-parking-internal-alb-xxxx.region.elb.amazonaws.com/parking
NOTIFICATION_SERVICE_URL=http://smart-parking-internal-alb-xxxx.region.elb.amazonaws.com/notification

# payment-service
BOOKING_SERVICE_URL=http://smart-parking-internal-alb-xxxx.region.elb.amazonaws.com/booking
NOTIFICATION_SERVICE_URL=http://smart-parking-internal-alb-xxxx.region.elb.amazonaws.com/notification

# scheduler-service
BOOKING_SERVICE_URL=http://smart-parking-internal-alb-xxxx.region.elb.amazonaws.com/booking
```

Keep `INTERNAL_API_KEY` the same value across all backend microservices.

## Service Environment Variables

Use these production-style values.

```env
JWT_SECRET=<strong-secret-from-secrets-manager>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://parking.example.com
INTERNAL_API_KEY=<strong-internal-secret-from-secrets-manager>
MONGO_URI=mongodb://<private-mongo-host>:27017/<service-db-name>
```

Service-specific examples:

```env
# auth-service
PORT=4001
MONGO_URI=mongodb://<private-mongo-host>:27017/authdb

# parking-service
PORT=4002
MONGO_URI=mongodb://<private-mongo-host>:27017/parkingdb

# booking-service
PORT=4003
MONGO_URI=mongodb://<private-mongo-host>:27017/bookingdb
PARKING_SERVICE_URL=http://<internal-alb-dns>/parking
NOTIFICATION_SERVICE_URL=http://<internal-alb-dns>/notification
BOOKING_HOLD_MINUTES=10

# payment-service
PORT=4004
MONGO_URI=mongodb://<private-mongo-host>:27017/paymentdb
BOOKING_SERVICE_URL=http://<internal-alb-dns>/booking
NOTIFICATION_SERVICE_URL=http://<internal-alb-dns>/notification
RAZORPAY_KEY_ID=<from-secrets-manager>
RAZORPAY_KEY_SECRET=<from-secrets-manager>

# scheduler-service
PORT=4005
BOOKING_SERVICE_URL=http://<internal-alb-dns>/booking
CRON_SCHEDULE=* * * * *

# notification-service
PORT=4006
MONGO_URI=mongodb://<private-mongo-host>:27017/notificationdb
```

## Deployment Order

1. Build and push Docker images to ECR for:
   - `frontend`
   - `auth-service`
   - `parking-service`
   - `booking-service`
   - `payment-service`
   - `scheduler-service`
   - `notification-service`

2. Create the VPC, public subnets, private app subnets, private DB subnets, route tables, Internet Gateway, and NAT Gateway or VPC endpoints.

3. Deploy MongoDB in private DB subnets, or use a managed/private Mongo-compatible option. Do not put MongoDB in a public subnet.

4. Create the security groups listed above.

5. Deploy backend microservices in private app subnets. Do not assign public IP addresses.

6. Create backend target groups and register backend targets.

7. Create the internal ALB and listener rules. Update backend service URLs to use the internal ALB.

8. Deploy the frontend in public subnets. Prefer serving the built React app with Nginx on port `80`.

9. Create `tg-frontend` and register frontend targets.

10. Create the public ALB, HTTPS listener, path rules, and URL rewrite transforms.

11. Create a Route 53 alias record:
    - `parking.example.com` -> public ALB

12. Test from your browser:
    - `https://parking.example.com`
    - `https://parking.example.com/auth/health`
    - `https://parking.example.com/parking/health`
    - `https://parking.example.com/booking/health`
    - `https://parking.example.com/payment/health`
    - `https://parking.example.com/notification/health`

## Testing And Troubleshooting

Target health:

```bash
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

Common problems:

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Target group is unhealthy | Health check path/port mismatch | Use `/health` and the service port |
| `/auth/login` returns 404 | Missing URL rewrite | Rewrite `/auth/login` to `/login` |
| Frontend loads but API fails | Browser is calling private DNS | Use relative `/auth`, `/parking`, etc. through public ALB |
| Booking cannot reserve slot | Internal ALB URL or `INTERNAL_API_KEY` mismatch | Check `PARKING_SERVICE_URL` and shared internal key |
| Payment cannot confirm booking | `BOOKING_SERVICE_URL` points to public/private wrong endpoint | Use internal ALB `/booking` URL |
| Backend cannot reach MongoDB | DB security group or route issue | Allow `sg-backend` to `sg-mongo:27017` |
| Targets are healthy but app fails | Missing environment variable | Check service logs and Secrets Manager values |

## AWS References

- Application Load Balancer listener rules and rule priority: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-rules.html
- Application Load Balancer URL rewrite transforms: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-transforms.html
- Application Load Balancer target groups: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html
- Target group health checks: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
- Internet-facing vs internal load balancer schemes: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html
