CC      = gcc
CFLAGS  = -std=c11 -O2 -Wall -Wextra -D_POSIX_C_SOURCE=200809L
LDFLAGS = -lm
IFLAGS  = -I../src

.PHONY: all run test dataset run-dataset clean

all: benchmark test_properties run_dataset

benchmark: benchmark.c
	$(CC) $(CFLAGS) $(IFLAGS) -o benchmark benchmark.c $(LDFLAGS)

test_properties: test_properties_copy.c
	$(CC) $(CFLAGS) $(IFLAGS) -o test_properties ../tests/test_properties.c $(LDFLAGS)

run_dataset: run_dataset.c
	$(CC) $(CFLAGS) $(IFLAGS) -o run_dataset run_dataset.c $(LDFLAGS)

run: benchmark
	./benchmark

test: run_dataset
	python3 generate_dataset.py 1000
	./run_dataset

props:
	$(CC) $(CFLAGS) $(IFLAGS) -o test_properties ../tests/test_properties.c $(LDFLAGS)
	./test_properties

dataset: run_dataset
	python3 generate_dataset.py 1000
	./run_dataset

run-dataset: run_dataset
	./run_dataset

clean:
	rm -f benchmark test_properties run_dataset
