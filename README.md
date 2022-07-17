# Gink

Gink is an open source, cryptographically secure, multi-master database system
based on Conflict Free Replicated Data Types (CRDTs) and Event Sourcing.  CRDTs
conceptualize updates in terms of the changes they’re intended to make to a
model.  On the other hand, the Event Sourcing approach characterizes each update
as an event (also called action) that holds all possibly relevant information
pertaining to something that happened, and defers the question of what to do
with those updates to later written consuming code (which can be designed as a
commutative reducer or something like a trigger).  Both of these models allow
for updates/events to originate at any node on the network and be propagated to
other nodes to arrive at an eventually consistent state.

Gink is designed to make on-prem-to-cloud migrations easy and multi-cloud
deployments trivial. The system will make it easy to start projects with a local
database and then migrate them to the cloud for wider deployment. It will be
designed for developers who value flexibility and robustness.

Conflict Free Replicated Data Types have been an active area of research in
recent years, but  multi-paradigm, enterprise-grade implementations have yet to
appear.  A good implementation would offer ultra-low-latency, cloud
independence, and 100% availability (at the cost of consistency in the case of
network disconnects). The “mergeable” multi-master capability will unlock new
architecture options for edge computing and dynamic database scaling.

This is not an officially supported Google product.

# Installing Required Dependencies on Linux

For the typescript implementation, this will install the system dependencies.
```
sudo apt-get install -y npm protobuf-compiler
sudo npm install -g ts-node
```

Inside the local copy of the repo, install the required npm packages with:
```
npm install
```

# Compile Proto Files
```
make
```

# Testing
```
npm run test
```
